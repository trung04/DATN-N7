# Recommendation benchmark — measured provisional results

Profiles: 44; repeats: 3. Silver labels and simulated history; not real-user evidence.

## cold

| Method | Precision@10 | Recall@10 | MRR@10 | nDCG@10 | ILD@10 | Catalog coverage@10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rating_only | 0.3000 | 0.0858 | 0.5295 | 0.3137 | 0.1824 | 0.0431 |
| tfidf | 0.8045 | 0.2695 | 0.9470 | 0.8384 | 0.1450 | 0.1444 |
| semantic | 0.8636 | 0.2896 | 0.9697 | 0.8887 | 0.1360 | 0.1394 |
| content_rating | 0.8136 | 0.2506 | 0.9773 | 0.8478 | 0.1465 | 0.1236 |
| personalized_mmr | 0.6591 | 0.1947 | 0.9636 | 0.6999 | 0.1738 | 0.1157 |

## warm

| Method | Precision@10 | Recall@10 | MRR@10 | nDCG@10 | ILD@10 | Catalog coverage@10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rating_only | 0.3000 | 0.0858 | 0.5295 | 0.3137 | 0.1824 | 0.0431 |
| tfidf | 0.8045 | 0.2695 | 0.9470 | 0.8384 | 0.1450 | 0.1444 |
| semantic | 0.8636 | 0.2896 | 0.9697 | 0.8887 | 0.1360 | 0.1394 |
| content_rating | 0.8136 | 0.2506 | 0.9773 | 0.8478 | 0.1465 | 0.1236 |
| personalized_mmr | 0.7273 | 0.2286 | 1.0000 | 0.7740 | 0.1594 | 0.1193 |

## Runtime

| Method | Mean ms | P95 ms | Shared-process RSS peak MiB |
| --- | ---: | ---: | ---: |
| rating_only | 130.27 | 298.94 | 973.74 |
| tfidf | 226.00 | 461.01 | 1012.59 |
| semantic | 465.07 | 802.18 | 2161.79 |
| content_rating | 492.19 | 817.57 | 2162.82 |
| personalized_mmr | 689.83 | 1037.69 | 2163.17 |

Latency is in-process and includes preference embedding; HTTP/model startup/TF-IDF fit excluded after warmup. RAM belongs to shared process, not independent method footprint. See summary.json for protocol.

Paired confidence intervals: paired-comparisons.json; 2,000 resamples over profiles within each cohort. Repeated calls are not independent users. Intervals are exploratory, unadjusted for multiple comparisons.

Do not choose a production winner solely from synthetic silver labels. TF-IDF can benefit from lexical-rule label bias; MMR trades ranking relevance for diversity. Validate labels and collect real interactions before claiming personalization efficacy.
