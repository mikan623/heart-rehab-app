// meal フィールドの文字列→配列マイグレーション
// 使い方:
//   node --env-file=.env.local scripts/migrate-meal-to-array.mjs
//
// --dry-run オプションで実際には更新せず確認だけできる:
//   node --env-file=.env.local scripts/migrate-meal-to-array.mjs --dry-run

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// 文字列なら配列に変換、すでに配列ならそのまま返す
function toArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
}

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN モード（更新は行いません）' : '🚀 マイグレーション開始');

  // meal フィールドがある全レコードを取得
  const records = await prisma.healthRecord.findMany({
    select: { id: true, meal: true },
  });

  console.log(`📊 対象レコード数: ${records.length}`);

  let needsMigration = 0;
  let skipped = 0;

  for (const record of records) {
    const meal = record.meal;

    // meal が null または対象外はスキップ
    if (!meal || typeof meal !== 'object' || Array.isArray(meal)) {
      skipped++;
      continue;
    }

    const { staple, mainDish, sideDish, other } = meal;

    // いずれかのフィールドが文字列なら変換が必要
    const needsUpdate =
      typeof staple === 'string' ||
      typeof mainDish === 'string' ||
      typeof sideDish === 'string';

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    needsMigration++;

    const updatedMeal = {
      staple:   toArray(staple),
      mainDish: toArray(mainDish),
      sideDish: toArray(sideDish),
      other:    typeof other === 'string' ? other : '',
    };

    console.log(`  📝 ID: ${record.id}`);
    console.log(`     変更前: staple=${JSON.stringify(staple)}, mainDish=${JSON.stringify(mainDish)}, sideDish=${JSON.stringify(sideDish)}`);
    console.log(`     変更後: staple=${JSON.stringify(updatedMeal.staple)}, mainDish=${JSON.stringify(updatedMeal.mainDish)}, sideDish=${JSON.stringify(updatedMeal.sideDish)}`);

    if (!isDryRun) {
      await prisma.healthRecord.update({
        where: { id: record.id },
        data: { meal: updatedMeal },
      });
    }
  }

  console.log('');
  console.log('✅ 完了');
  console.log(`   変換対象: ${needsMigration} 件`);
  console.log(`   スキップ: ${skipped} 件`);
  if (isDryRun) {
    console.log('');
    console.log('💡 実際に更新するには --dry-run を外して実行してください');
  }
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
