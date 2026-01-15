# AWSリソース命名（推奨）＆ `ecs-task-def.json` 埋め込みチェックリスト

対象: `mikan623/heart-rehab-app`  
リージョン: `ap-northeast-1`（東京）  
本番URL: `app.<domain>`  
アプリport: **3002**

---

## 1) 命名規則（就活で説明しやすい・迷子にならない）
環境: `prod` を suffix に統一します。

### 推奨（このまま採用OK）
- **ECR repository**: `heart-rehab-app-prod`
- **ECS cluster**: `heart-rehab-prod`
- **ECS service**: `heart-rehab-web-prod`
- **ECS task family**: `heart-rehab-web-prod`
- **Container name**: `web`
- **ALB**: `heart-rehab-alb-prod`
- **Target group**: `heart-rehab-tg-prod-3002`
- **CloudWatch Logs group**: `/ecs/heart-rehab-web-prod`
- **Secrets（Secrets Manager）**
  - `prod/heart-rehab/DATABASE_URL`
  - `prod/heart-rehab/NEXT_PUBLIC_LIFF_ID`
  - `prod/heart-rehab/LINE_CHANNEL_ACCESS_TOKEN`
  - `prod/heart-rehab/LINE_CHANNEL_SECRET`
  - （必要なら）`prod/heart-rehab/HF_TOKEN`
- **IAM**
  - GitHub OIDC role: `heart-rehab-gha-deploy-prod`
  - Task execution role: `ecsTaskExecutionRole`（AWS推奨名でもOK）
  - Task role: `heart-rehab-web-prod-task-role`

---

## 2) `ecs-task-def.json` に埋めるもの
このリポジトリの `ecs-task-def.json` はプレースホルダを含みます。

### 置換ポイント
- AWSアカウントID: `920004594871`（反映済み）
- Secrets ARN（`valueFrom`）: Secrets ManagerのARNに差し替え

---

## 3) Secrets ARN の取り方（最短）
Secrets Manager → 対象のsecret → **ARN** をコピー  
（例: `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/heart-rehab/DATABASE_URL-xxxx`)

> 注意: `valueFrom` は **Secret ARN（またはARN + :key）** を使います。  
> まずは「secret 1個 = 値1つ」で作るのが簡単です。

### 3-1) 今回の命名（推奨）
4つを別々のSecretで作る前提:
- `prod/heart-rehab/DATABASE_URL`
- `prod/heart-rehab/NEXT_PUBLIC_LIFF_ID`
- `prod/heart-rehab/LINE_CHANNEL_ACCESS_TOKEN`
- `prod/heart-rehab/LINE_CHANNEL_SECRET`

作成後、それぞれのARNを `ecs-task-def.json` の `valueFrom` に貼り付けます。  
（現在は末尾が `-xxxx` の仮文字列なので、**実ARNに丸ごと置換**してください）

### 3-2) まとめて1つのSecretにした場合（今回）
「キー/値」で1つのSecretにまとめてもOKです。ECS側は **JSONキー指定**で参照します。

- まとめシークレットARN（例）:
  - `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:prod/heart-rehab/DATABASE_URL-uvHZyy`
- `valueFrom` の形式:
  - `...:json-key::`

例（DATABASE_URLを取り出す）:
- `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:prod/heart-rehab/DATABASE_URL-uvHZyy:prod/heart-rehab/DATABASE_URL::`

> もしJSONキーに `/` を含めるのが不安なら、Secrets Manager側のキー名を  
> `DATABASE_URL`, `NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` のようにシンプルにするのがおすすめです。

### 3-3) 4つを別々のSecretとして作った場合（シンプルでおすすめ）
今回あなたが取得してくれたように、4つをそれぞれ独立したSecretとして作っているなら、ECSは **ARNをそのまま `valueFrom` に貼るだけ**です。

- `DATABASE_URL`: `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:DATABASE_URL-mh9Bpx`
- `NEXT_PUBLIC_LIFF_ID`: `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:NEXT_PUBLIC_LIFF_ID-3I1fZs`
- `LINE_CHANNEL_ACCESS_TOKEN`: `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:LINE_CHANNEL_ACCESS_TOKEN-jmvhwG`
- `LINE_CHANNEL_SECRET`: `arn:aws:secretsmanager:ap-northeast-1:920004594871:secret:LINE_CHANNEL_SECRET-jrXGDG`

---

## 4) `ecs-task-def.json` 埋め込みチェック（コピペ手順）
1) `executionRoleArn` の `<ACCOUNT_ID>` を置換  
2) `taskRoleArn` の `<ACCOUNT_ID>` を置換  
3) `secrets[].valueFrom` を、作成したSecrets ARNへ置換（`-xxxx` を実値へ）  
4) `awslogs-group` が作成済み or 自動作成される設定になっているか確認  

---

## 5) GitHub Actions の Variables / Secrets（再掲）
GitHub → Settings → Secrets and variables → Actions

### Variables
- `AWS_REGION`: `ap-northeast-1`
- `ECR_REPOSITORY`: `heart-rehab-app-prod`
- `ECS_CLUSTER`: `heart-rehab-prod`
- `ECS_SERVICE`: `heart-rehab-web-prod`
- `ECS_TASK_DEFINITION`: `ecs-task-def.json`
- `CONTAINER_NAME`: `web`

### Secrets
- `AWS_ROLE_TO_ASSUME`: `arn:aws:iam::<ACCOUNT_ID>:role/heart-rehab-gha-deploy-prod`

---

## 6) ALB / TargetGroup で必ず揃える値
- **TargetGroup port**: `3002`
- **Health check path**: `/api/test`
- **ECS security group inbound**: `3002` from `alb-sg` only

---

## 7) 次にやること（推奨順）
1) 命名をこのチェックリストで確定  
2) AWS上でECR/ECS/ALB/TargetGroup/Role/Secretsを作る  
3) `ecs-task-def.json` の `<ACCOUNT_ID>` と Secrets ARN を埋める  
4) `main` にpushして GitHub Actions で初回デプロイ  
5) `https://app.<domain>/api/test` が返ることを確認

