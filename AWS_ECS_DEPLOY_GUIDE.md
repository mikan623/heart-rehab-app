# AWS移行（ECS Fargate + RDS + GitHub Actions(OIDC)）手順ガイド

対象リポジトリ: `mikan623/heart-rehab-app`  
前提: 本番URLは `app.<domain>`、リージョンは `ap-northeast-1`、アプリportは **3002**

---

## 0. 全体像（作るもの）
- Route53: ドメイン取得/ホストゾーン
- ACM: `app.<domain>` の証明書（DNS検証）
- VPC: 2AZ / Public(ALB) / Private(ECS) / Private(DB)
- ALB: 443終端 + TargetGroup(3002)
- ECR: コンテナレジストリ
- ECS(Fargate): Service/TaskDefinition
- Secrets Manager: `DATABASE_URL` 等
- RDS(Aurora Postgres推奨) + RDS Proxy
- GitHub Actions: build → ECR push → ECS deploy（OIDC）
- (任意) EventBridge Scheduler + Lambda: リマインダー

---

## 1. Route53でドメイン取得 → `app.<domain>` をALBへ向ける
1) Route53でドメイン取得（もしくは外部取得ドメインのNSをRoute53へ委任）  
2) Hosted Zone（`<domain>`）を確認  
3) 最終的に、**Aレコード（Alias）** で `app` を ALB に向ける

---

## 2. ACM（東京リージョン）で証明書発行
1) ACM → Request certificate  
2) `app.<domain>` を追加（必要なら `<domain>` も）  
3) Validation: DNS  
4) Route53へCNAMEを作成（コンソールから自動作成が楽）

---

## 3. VPC（2AZ）とサブネット
推奨構成:
- Public Subnet x2（ALB）
- Private Subnet x2（ECS）
- Private Subnet x2（RDS）
- NAT Gateway（Private→外向き通信が必要な場合：ECR pull等）

Security Group:
- `alb-sg`: inbound 80/443 from 0.0.0.0/0
- `ecs-sg`: inbound 3002 from `alb-sg` only
- `rds-proxy-sg`: inbound 5432 from `ecs-sg`
- `rds-sg`: inbound 5432 from `rds-proxy-sg`

---

## 4. RDS（Aurora Postgres推奨）+ RDS Proxy
1) Aurora/RDS(Postgres) を **DB用Private Subnet** に作成  
2) Secrets Manager にDB認証情報を保存（RDS Proxyで利用）  
3) RDS Proxy作成  
4) **Proxyエンドポイント** を `DATABASE_URL` に使う

`DATABASE_URL` 例:
`postgresql://USER:PASSWORD@<RDS_PROXY_ENDPOINT>:5432/DBNAME?schema=public`

---

## 5. Supabase → AWS DB 移行（小規模: pg_dump/pg_restore）
SupabaseはPostgresなので、基本は dump/restore が最短です。

### 5-1) Supabaseからダンプ
例（URLはSupabaseの接続情報を使用）:

```bash
pg_dump --no-owner --no-acl --format=custom "$SUPABASE_DATABASE_URL" > dump.backup
```

### 5-2) AWS側へリストア
踏み台（EC2）やSSM Port Forwarding経由でRDSへ接続できる状態で:

```bash
pg_restore --no-owner --no-acl --clean --if-exists --dbname "$AWS_DATABASE_URL" dump.backup
```

### 5-3) Prisma整合確認
本番環境（ECS）で `prisma migrate deploy` を実行する流れに寄せるのが安全です。

---

## 6. ECR作成 → コンテナpushの準備
ECRにリポジトリを作成（例: `heart-rehab-app-prod`）

---

## 7. ECS(Fargate) + ALB(HTTPS)
### 7-1) ALB
- Public Subnetに配置
- Listener:
  - 80 → 443 redirect
  - 443 → TargetGroup
- TargetGroup:
  - Port: **3002**
  - Health check path: `/api/test`（このリポジトリに既存）

### 7-2) ECS
- Cluster作成
- Task Definition:
  - Port mapping: **3002**
  - Logs: CloudWatch Logs
  - Env/Secrets: Secrets Manager参照（直書きしない）
- Service:
  - Private Subnetに配置
  - SG: `ecs-sg`
  - ALB TargetGroupに紐付け

このリポジトリにはECS向けの雛形が含まれます:
- `Dockerfile`（port 3002）
- `ecs-task-def.json`（port 3002 / Secrets参照）

---

## 8. GitHub Actions（OIDC）で自動デプロイ
### 8-1) AWS側: OIDC Provider作成
IAM → Identity providers → Add provider  
Provider type: OpenID Connect  
URL: `https://token.actions.githubusercontent.com`  
Audience: `sts.amazonaws.com`

### 8-2) AWS側: Role作成（信頼ポリシー）
信頼ポリシー例（`main` ブランチ限定）:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:mikan623/heart-rehab-app:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### 8-3) AWS側: 権限ポリシー（まずは実用的な最小セット）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["ecr:GetAuthorizationToken"], "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
        "ecr:BatchGetImage"
      ],
      "Resource": "arn:aws:ecr:ap-northeast-1:920004594871:repository/<ECR_REPOSITORY>"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:DescribeTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": [
        "arn:aws:iam::920004594871:role/ecsTaskExecutionRole",
        "arn:aws:iam::920004594871:role/heart-rehab-web-prod-task-role"
      ]
    }
  ]
}
```

### 8-4) GitHub側: Variables / Secrets を設定
Repository → Settings → Secrets and variables → Actions

Variables:
- `AWS_REGION`: `ap-northeast-1`
- `ECR_REPOSITORY`: 例 `heart-rehab-app-prod`
- `ECS_CLUSTER`: 例 `heart-rehab-prod`
- `ECS_SERVICE`: 例 `web-prod`
- `ECS_TASK_DEFINITION`: `ecs-task-def.json`
- `CONTAINER_NAME`: `web`

Secrets:
- `AWS_ROLE_TO_ASSUME`: 作成したRoleのARN

Workflowはリポジトリに同梱:
- `.github/workflows/deploy.yml`

---

## 9. （任意）リマインダー（EventBridge Scheduler → Lambda）
人数が数十人・1日4回なら、Lambdaで十分です。
- EventBridge Scheduler: cronで起動
- Lambda: DB参照→対象へLINE通知
- CloudWatch Logs/Alarm: 失敗監視

---

## 10. 動作確認チェック
- `https://app.<domain>/api/test` が 200 になる
- `https://app.<domain>/health-records` で保存/取得できる
- DB接続（RDS Proxy）でエラーが出ない
- GitHubの `main` pushで自動デプロイされる

