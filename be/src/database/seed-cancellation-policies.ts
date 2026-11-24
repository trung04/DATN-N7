import dataSource from './typeorm.datasource';

const DEMO_POLICY = {
  cancelHours: 24,
  penaltyPercent: 50,
  description:
    'Miễn phí hủy trong 24 giờ đầu kể từ lúc đặt. Từ đủ 24 giờ, phí hủy là 50% tổng tiền booking. Không thể hủy từ giờ nhận phòng.',
};

async function seedCancellationPolicies(): Promise<void> {
  await dataSource.initialize();
  try {
    const hotelsSeeded = await dataSource.transaction(async (manager) => {
      const hotels = (await manager.query(
        'SELECT "id" FROM "hotels" ORDER BY "id" FOR UPDATE',
      )) as Array<{ id: string }>;

      for (const hotel of hotels) {
        const activePolicies = (await manager.query(
          `SELECT "id" FROM "cancellation_policies"
           WHERE "hotel_id" = $1 AND "is_active" = true
           FOR UPDATE`,
          [hotel.id],
        )) as Array<{ id: string }>;

        let policyId = activePolicies[0]?.id;
        if (!policyId) {
          const existingPolicies = (await manager.query(
            `SELECT "id" FROM "cancellation_policies"
             WHERE "hotel_id" = $1
             ORDER BY "created_at" ASC, "id" ASC
             LIMIT 1 FOR UPDATE`,
            [hotel.id],
          )) as Array<{ id: string }>;
          policyId = existingPolicies[0]?.id;
        }

        if (policyId) {
          await manager.query(
            `UPDATE "cancellation_policies"
             SET "cancel_hours" = $2,
                 "penalty_percent" = $3,
                 "cancellation_allowed" = true,
                 "description" = $4,
                 "is_active" = true,
                 "updated_at" = now()
             WHERE "id" = $1`,
            [policyId, DEMO_POLICY.cancelHours, DEMO_POLICY.penaltyPercent, DEMO_POLICY.description],
          );
        } else {
          const inserted = (await manager.query(
            `INSERT INTO "cancellation_policies"
               ("hotel_id", "name", "cancel_hours", "penalty_percent",
                "cancellation_allowed", "description", "is_active")
             VALUES ($1, $2, $3, $4, true, $5, true)
             RETURNING "id"`,
            [
              hotel.id,
              'Chính sách demo: miễn phí 24 giờ',
              DEMO_POLICY.cancelHours,
              DEMO_POLICY.penaltyPercent,
              DEMO_POLICY.description,
            ],
          )) as Array<{ id: string }>;
          policyId = inserted[0]!.id;
        }

        await manager.query(
          `UPDATE "cancellation_policies"
           SET "is_active" = false, "updated_at" = now()
           WHERE "hotel_id" = $1 AND "id" <> $2 AND "is_active" = true`,
          [hotel.id, policyId],
        );
      }

      return hotels.length;
    });

    console.log(`Seeded cancellation policies for ${hotelsSeeded} hotels.`);
  } finally {
    await dataSource.destroy();
  }
}

void seedCancellationPolicies().catch((error: unknown) => {
  console.error('Failed to seed cancellation policies.', error);
  process.exitCode = 1;
});
