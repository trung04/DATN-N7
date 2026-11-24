import dataSource from './typeorm.datasource';

const IMAGE_ASSETS = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    url: '/images/da-nang-coast.webp',
    altText: 'Bờ biển Đà Nẵng',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    url: '/images/hoi-an-lanterns.webp',
    altText: 'Phố cổ Hội An',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    url: '/images/hue-citadel.webp',
    altText: 'Đại Nội Huế',
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    url: '/images/da-lat-pines.webp',
    altText: 'Rừng thông Đà Lạt',
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    url: '/images/da-nang-dragon-bridge.jpg',
    altText: 'Cầu Rồng, Đà Nẵng',
    sourceProvider: 'WIKIMEDIA_COMMONS',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Da_nang_dragon_bridge.jpg',
    attributionText: 'Thangphan, CC0 1.0 Universal (Wikimedia Commons).',
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    url: '/images/hoan-kiem-lake.jpg',
    altText: 'Hồ Hoàn Kiếm, Hà Nội',
    sourceProvider: 'WIKIMEDIA_COMMONS',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hoan_Kiem_Lake.jpg',
    attributionText: 'rex pe, CC BY 2.0 (Wikimedia Commons).',
  },
  {
    id: '20000000-0000-4000-8000-000000000007',
    url: '/images/ha-long-bay.jpg',
    altText: 'Vịnh Hạ Long, Quảng Ninh',
    sourceProvider: 'WIKIMEDIA_COMMONS',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ha_Long_Bay,_Vietnam.jpg',
    attributionText: 'Vyacheslav Argenberg, CC BY 4.0 (Wikimedia Commons).',
  },
] as const;

const PLACES = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Bãi biển Mỹ Khê',
    city: 'Đà Nẵng',
    address: 'Đường Võ Nguyên Giáp, phường Phước Mỹ, quận Sơn Trà',
    provinceCode: 'DN',
    latitude: 16.0544,
    longitude: 108.243,
    description:
      'Bãi biển dài với bờ cát thoải, thích hợp tắm biển, đi dạo và ngắm bình minh.',
    duration: 180,
    opening: 'Mở cửa cả ngày; nên tắm biển trong khung giờ có lực lượng cứu hộ.',
    bestTimes: ['Sáng sớm', 'Chiều muộn'],
    suitableFor: ['Gia đình', 'Cặp đôi', 'Bạn bè'],
    amenities: ['Lối đi bộ', 'Dịch vụ ven biển'],
    imageId: IMAGE_ASSETS[0].id,
    topicCodes: ['BEACH', 'RELAXATION', 'FAMILY'],
    priceId: '40000000-0000-4000-8000-000000000001',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    name: 'Ngũ Hành Sơn',
    city: 'Đà Nẵng',
    address: '81 đường Huyền Trân Công Chúa, phường Hòa Hải, quận Ngũ Hành Sơn',
    provinceCode: 'DN',
    latitude: 16.0039,
    longitude: 108.2634,
    description:
      'Quần thể núi đá vôi, hang động và chùa cổ ở phía nam thành phố Đà Nẵng.',
    duration: 180,
    opening: 'Khoảng 07:00–17:30; giờ tham quan có thể thay đổi theo mùa.',
    bestTimes: ['Buổi sáng'],
    suitableFor: ['Văn hóa', 'Khám phá', 'Đi bộ'],
    amenities: ['Bãi đỗ xe', 'Nhà vệ sinh'],
    imageId: IMAGE_ASSETS[0].id,
    topicCodes: ['CULTURE', 'EXPLORATION'],
    priceId: '40000000-0000-4000-8000-000000000002',
    minPrice: 40000,
    maxPrice: 40000,
    priceUnit: 'vé người lớn',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    name: 'Bán đảo Sơn Trà',
    city: 'Đà Nẵng',
    address: 'Bán đảo Sơn Trà, quận Sơn Trà',
    provinceCode: 'DN',
    latitude: 16.1202,
    longitude: 108.3000,
    description:
      'Khu vực núi rừng ven biển có nhiều điểm ngắm cảnh nhìn ra thành phố và vịnh Đà Nẵng.',
    duration: 240,
    opening: 'Một số tuyến đường có thể hạn chế theo thời tiết và quy định bảo tồn.',
    bestTimes: ['Sáng sớm', 'Chiều muộn'],
    suitableFor: ['Thiên nhiên', 'Khám phá', 'Bạn bè'],
    amenities: ['Điểm ngắm cảnh'],
    imageId: IMAGE_ASSETS[0].id,
    topicCodes: ['NATURE', 'EXPLORATION'],
    priceId: '40000000-0000-4000-8000-000000000003',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    name: 'Cầu Rồng',
    city: 'Đà Nẵng',
    address: 'Đường Nguyễn Văn Linh, quận Hải Châu',
    provinceCode: 'DN',
    latitude: 16.0614,
    longitude: 108.2278,
    description:
      'Cây cầu bắc qua sông Hàn, là điểm dạo bộ và ngắm cảnh trung tâm thành phố.',
    duration: 60,
    opening: 'Khu vực cầu mở cả ngày; lịch phun lửa có thể thay đổi theo thông báo địa phương.',
    bestTimes: ['Buổi tối'],
    suitableFor: ['Gia đình', 'Cặp đôi', 'Khám phá'],
    amenities: ['Lối đi bộ ven sông'],
    imageId: IMAGE_ASSETS[4].id,
    topicCodes: ['EXPLORATION', 'FAMILY'],
    priceId: '40000000-0000-4000-8000-000000000004',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    name: 'Phố cổ Hội An',
    city: 'Quảng Nam',
    address: 'Phường Minh An, thành phố Hội An',
    provinceCode: 'QNA',
    latitude: 15.8776,
    longitude: 108.3267,
    description:
      'Khu phố di sản với nhà cổ, hội quán, cửa hàng thủ công và không gian ven sông Hoài.',
    duration: 240,
    opening: 'Phố đi bộ hoạt động theo khung giờ do địa phương quy định.',
    bestTimes: ['Chiều muộn', 'Buổi tối'],
    suitableFor: ['Văn hóa', 'Ẩm thực', 'Cặp đôi', 'Gia đình'],
    amenities: ['Phố đi bộ', 'Nhà vệ sinh công cộng'],
    imageId: IMAGE_ASSETS[1].id,
    topicCodes: ['CULTURE', 'FOOD', 'SHOPPING'],
    priceId: '40000000-0000-4000-8000-000000000005',
    minPrice: 120000,
    maxPrice: 120000,
    priceUnit: 'vé tham quan',
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    name: 'Bãi biển An Bàng',
    city: 'Quảng Nam',
    address: 'Phường Cẩm An, thành phố Hội An',
    provinceCode: 'QNA',
    latitude: 15.9126,
    longitude: 108.3396,
    description:
      'Bãi biển gần Hội An, phù hợp nghỉ ngơi và kết hợp tham quan phố cổ.',
    duration: 150,
    opening: 'Mở cửa cả ngày; nên tắm biển trong khung giờ có cứu hộ.',
    bestTimes: ['Sáng sớm', 'Chiều muộn'],
    suitableFor: ['Biển', 'Nghỉ dưỡng', 'Gia đình'],
    amenities: ['Dịch vụ ven biển', 'Bãi đỗ xe'],
    imageId: IMAGE_ASSETS[1].id,
    topicCodes: ['BEACH', 'RELAXATION'],
    priceId: '40000000-0000-4000-8000-000000000006',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    name: 'Đại Nội Huế',
    city: 'Huế',
    address: 'Đường 23 Tháng 8, phường Đông Ba',
    provinceCode: 'TTH',
    latitude: 16.4698,
    longitude: 107.5770,
    description:
      'Quần thể cung điện và công trình thuộc Kinh thành Huế, gắn với triều Nguyễn.',
    duration: 240,
    opening: 'Giờ tham quan thay đổi theo mùa; nên kiểm tra thông báo trước chuyến đi.',
    bestTimes: ['Buổi sáng'],
    suitableFor: ['Văn hóa', 'Lịch sử', 'Gia đình'],
    amenities: ['Bãi đỗ xe', 'Nhà vệ sinh'],
    imageId: IMAGE_ASSETS[2].id,
    topicCodes: ['CULTURE', 'EXPLORATION'],
    priceId: '40000000-0000-4000-8000-000000000007',
    minPrice: 200000,
    maxPrice: 200000,
    priceUnit: 'vé người lớn',
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    name: 'Chùa Thiên Mụ',
    city: 'Huế',
    address: 'Đường Nguyễn Phúc Nguyên, phường Kim Long',
    provinceCode: 'TTH',
    latitude: 16.4520,
    longitude: 107.5453,
    description:
      'Ngôi chùa cổ bên sông Hương với tháp Phước Duyên là dấu mốc quen thuộc của Huế.',
    duration: 90,
    opening: 'Tham quan ban ngày; giữ yên tĩnh và tuân thủ quy định tại khuôn viên chùa.',
    bestTimes: ['Sáng sớm', 'Chiều muộn'],
    suitableFor: ['Văn hóa', 'Tâm linh', 'Đi bộ'],
    amenities: ['Bãi đỗ xe'],
    imageId: IMAGE_ASSETS[2].id,
    topicCodes: ['CULTURE', 'RELAXATION'],
    priceId: '40000000-0000-4000-8000-000000000008',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000009',
    name: 'Hồ Xuân Hương',
    city: 'Đà Lạt',
    address: 'Phường 1, trung tâm thành phố Đà Lạt',
    provinceCode: 'LD',
    latitude: 11.9416,
    longitude: 108.4384,
    description:
      'Hồ nước ở trung tâm Đà Lạt, có đường dạo bộ và nhiều điểm ngắm cảnh quanh hồ.',
    duration: 90,
    opening: 'Khu vực ven hồ mở cả ngày.',
    bestTimes: ['Sáng sớm', 'Chiều muộn'],
    suitableFor: ['Thiên nhiên', 'Gia đình', 'Cặp đôi'],
    amenities: ['Lối đi bộ', 'Dịch vụ quanh hồ'],
    imageId: IMAGE_ASSETS[3].id,
    topicCodes: ['NATURE', 'RELAXATION', 'FAMILY'],
    priceId: '40000000-0000-4000-8000-000000000009',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000010',
    name: 'Hồ Tuyền Lâm',
    city: 'Đà Lạt',
    address: 'Phường 4, thành phố Đà Lạt',
    provinceCode: 'LD',
    latitude: 11.8994,
    longitude: 108.4417,
    description:
      'Hồ nằm giữa rừng thông, có các hoạt động tham quan và nghỉ dưỡng quanh khu vực.',
    duration: 180,
    opening: 'Khu vực hồ mở cả ngày; hoạt động dịch vụ có giờ riêng.',
    bestTimes: ['Buổi sáng'],
    suitableFor: ['Thiên nhiên', 'Nghỉ dưỡng', 'Bạn bè'],
    amenities: ['Điểm ngắm cảnh', 'Dịch vụ thuyền'],
    imageId: IMAGE_ASSETS[3].id,
    topicCodes: ['NATURE', 'RELAXATION', 'EXPLORATION'],
    priceId: '40000000-0000-4000-8000-000000000010',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000011',
    name: 'Hồ Hoàn Kiếm',
    city: 'Hà Nội',
    address: 'Phường Hàng Trống, quận Hoàn Kiếm',
    provinceCode: 'HN',
    latitude: 21.0287,
    longitude: 105.8524,
    description:
      'Không gian đi bộ quanh hồ ở trung tâm Hà Nội, gần đền Ngọc Sơn và khu phố cổ.',
    duration: 90,
    opening: 'Khu vực ven hồ mở cả ngày; phố đi bộ hoạt động theo lịch của thành phố.',
    bestTimes: ['Sáng sớm', 'Buổi tối'],
    suitableFor: ['Văn hóa', 'Gia đình', 'Đi bộ'],
    amenities: ['Lối đi bộ', 'Gần điểm tham quan'],
    imageId: IMAGE_ASSETS[5].id,
    topicCodes: ['CULTURE', 'EXPLORATION', 'FAMILY'],
    priceId: '40000000-0000-4000-8000-000000000011',
    minPrice: 0,
    maxPrice: 0,
    priceUnit: 'người',
  },
  {
    id: '30000000-0000-4000-8000-000000000012',
    name: 'Vịnh Hạ Long',
    city: 'Hạ Long',
    address: 'Thành phố Hạ Long, tỉnh Quảng Ninh',
    provinceCode: 'QNI',
    latitude: 20.9101,
    longitude: 107.1839,
    description:
      'Vịnh biển với các đảo đá vôi; có thể tham quan bằng tàu theo tuyến được cấp phép.',
    duration: 360,
    opening: 'Lịch tàu và tuyến tham quan phụ thuộc thời tiết, cảng và đơn vị khai thác.',
    bestTimes: ['Buổi sáng'],
    suitableFor: ['Thiên nhiên', 'Khám phá', 'Gia đình'],
    amenities: ['Bến tàu', 'Dịch vụ tham quan'],
    imageId: IMAGE_ASSETS[6].id,
    topicCodes: ['NATURE', 'EXPLORATION', 'FAMILY'],
    priceId: '40000000-0000-4000-8000-000000000012',
    minPrice: 250000,
    maxPrice: 800000,
    priceUnit: 'vé tham quan, chưa gồm tàu',
  },
] as const;

const TOPIC_NAMES: Record<string, string> = {
  BEACH: 'Biển',
  NATURE: 'Thiên nhiên',
  FOOD: 'Ẩm thực',
  CULTURE: 'Văn hóa',
  SHOPPING: 'Mua sắm',
  RELAXATION: 'Nghỉ dưỡng',
  EXPLORATION: 'Khám phá',
  FAMILY: 'Gia đình',
};

async function seedPlaceCatalog(): Promise<void> {
  await dataSource.initialize();
  try {
    const insertedCount = await dataSource.transaction(async (manager) => {
      for (const asset of IMAGE_ASSETS) {
        await manager.query(
          `INSERT INTO "images" (
             "id", "storage_provider", "image_url", "alt_text",
             "source_provider", "source_url", "attribution_text",
             "created_at", "updated_at"
           ) VALUES ($1, 'EXTERNAL', $2, $3, $4, $5, $6, now(), now())
           ON CONFLICT ("id") DO UPDATE SET
             "image_url" = EXCLUDED."image_url",
             "alt_text" = EXCLUDED."alt_text",
             "source_provider" = EXCLUDED."source_provider",
             "source_url" = EXCLUDED."source_url",
             "attribution_text" = EXCLUDED."attribution_text",
             "deleted_at" = NULL,
             "updated_at" = now()`,
          [
            asset.id,
            asset.url,
            asset.altText,
            'sourceProvider' in asset ? asset.sourceProvider : 'APP_ASSET',
            'sourceUrl' in asset ? asset.sourceUrl : asset.url,
            'attributionText' in asset
              ? asset.attributionText
              : 'Ảnh nằm trong bộ tài nguyên giao diện của dự án.',
          ],
        );
      }

      for (const [code, name] of Object.entries(TOPIC_NAMES)) {
        await manager.query(
          `UPDATE "topics" SET "name" = $2, "updated_at" = now()
           WHERE "code" = $1 AND "deleted_at" IS NULL`,
          [code, name],
        );
      }

      const categoryRows = (await manager.query(
        `SELECT "id" FROM "place_categories"
         WHERE "code" = 'ATTRACTION' AND "deleted_at" IS NULL LIMIT 1`,
      )) as Array<{ id: string }>;
      const categoryId = categoryRows[0]?.id;
      if (!categoryId) throw new Error('Missing ATTRACTION place category');

      for (const place of PLACES) {
        await manager.query(
          `INSERT INTO "places" (
             "id", "name", "description", "address", "city", "country_code",
             "province_code", "timezone", "latitude", "longitude", "status",
             "average_rating", "review_count", "opening_times",
             "estimated_visit_duration_minutes", "amenities", "best_visit_times",
             "suitable_for", "source_type", "created_at", "updated_at"
           ) VALUES (
             $1, $2, $3, $4, $5, 'VN', $6, 'Asia/Ho_Chi_Minh', $7, $8, 'ACTIVE',
             0, 0, $9::jsonb, $10, $11::text[], $12::text[], $13::text[],
             'MANUAL', now(), now()
           )
           ON CONFLICT ("id") DO UPDATE SET
             "name" = EXCLUDED."name",
             "description" = EXCLUDED."description",
             "address" = EXCLUDED."address",
             "city" = EXCLUDED."city",
             "country_code" = EXCLUDED."country_code",
             "province_code" = EXCLUDED."province_code",
             "timezone" = EXCLUDED."timezone",
             "latitude" = EXCLUDED."latitude",
             "longitude" = EXCLUDED."longitude",
             "status" = EXCLUDED."status",
             "opening_times" = EXCLUDED."opening_times",
             "estimated_visit_duration_minutes" = EXCLUDED."estimated_visit_duration_minutes",
             "amenities" = EXCLUDED."amenities",
             "best_visit_times" = EXCLUDED."best_visit_times",
             "suitable_for" = EXCLUDED."suitable_for",
             "deleted_at" = NULL,
             "updated_at" = now()`,
          [
            place.id,
            place.name,
            place.description,
            place.address,
            place.city,
            place.provinceCode,
            place.latitude,
            place.longitude,
            JSON.stringify({ display: place.opening }),
            place.duration,
            place.amenities,
            place.bestTimes,
            place.suitableFor,
          ],
        );

        await manager.query(
          `INSERT INTO "place_category_mappings"
             ("place_id", "place_category_id") VALUES ($1, $2)
           ON CONFLICT ("place_id", "place_category_id") WHERE "deleted_at" IS NULL
           DO NOTHING`,
          [place.id, categoryId],
        );

        for (const topicCode of place.topicCodes) {
          await manager.query(
            `INSERT INTO "place_topics" ("place_id", "topic_id")
             SELECT $1, "id" FROM "topics"
             WHERE "code" = $2 AND "deleted_at" IS NULL
             ON CONFLICT ("place_id", "topic_id") WHERE "deleted_at" IS NULL
             DO NOTHING`,
            [place.id, topicCode],
          );
        }

        await manager.query(
          `UPDATE "place_images" SET "deleted_at" = now(), "updated_at" = now()
           WHERE "place_id" = $1 AND "image_id" <> $2 AND "deleted_at" IS NULL`,
          [place.id, place.imageId],
        );

        await manager.query(
          `INSERT INTO "place_images" ("place_id", "image_id", "image_order")
           VALUES ($1, $2, 1)
           ON CONFLICT ("place_id", "image_id") WHERE "deleted_at" IS NULL
           DO UPDATE SET "image_order" = 1, "deleted_at" = NULL,
                         "updated_at" = now()`,
          [place.id, place.imageId],
        );

        await manager.query(
          `INSERT INTO "reference_prices" (
             "id", "place_id", "cost_type", "min_price", "max_price",
             "currency", "pricing_unit", "description", "price_source",
             "created_at", "updated_at"
           ) VALUES ($1, $2, 'ADMISSION', $3, $4, 'VND', $5,
                     'Mức tham khảo phục vụ dữ liệu demo.', 'DEMO_SEED', now(), now())
           ON CONFLICT ("id") DO UPDATE SET
             "place_id" = EXCLUDED."place_id",
             "cost_type" = EXCLUDED."cost_type",
             "min_price" = EXCLUDED."min_price",
             "max_price" = EXCLUDED."max_price",
             "currency" = EXCLUDED."currency",
             "pricing_unit" = EXCLUDED."pricing_unit",
             "description" = EXCLUDED."description",
             "price_source" = EXCLUDED."price_source",
             "deleted_at" = NULL,
             "updated_at" = now()`,
          [
            place.priceId,
            place.id,
            place.minPrice,
            place.maxPrice,
            place.priceUnit,
          ],
        );
      }

      return PLACES.length;
    });

    console.log(`Seeded ${insertedCount} demo places with images and catalog data.`);
  } finally {
    await dataSource.destroy();
  }
}

void seedPlaceCatalog().catch((error: unknown) => {
  console.error('Failed to seed place catalog.', error);
  process.exitCode = 1;
});
