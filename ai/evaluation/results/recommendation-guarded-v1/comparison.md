# Guarded Recommendation: test comparison

Parameters selected using 5 validation profiles; results below use 17 test profiles, 3 repeats. Silver labels, simulated history.

| Method | K | Precision | Recall | MRR | nDCG | ILD | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| semantic | 5 | 0.8941 | 0.1572 | 0.9608 | 0.8839 | 0.1377 | 428.43 |
| semantic | 10 | 0.8765 | 0.2736 | 0.9608 | 0.8941 | 0.1370 | 428.43 |
| semantic | 20 | 0.8059 | 0.4098 | 0.9608 | 0.8893 | 0.1431 | 428.43 |
| legacy_personalized | 5 | 0.8118 | 0.1274 | 1.0000 | 0.8428 | 0.1613 | 879.57 |
| legacy_personalized | 10 | 0.7588 | 0.2340 | 1.0000 | 0.8062 | 0.1584 | 879.57 |
| legacy_personalized | 20 | 0.7059 | 0.3541 | 1.0000 | 0.7993 | 0.1573 | 879.57 |
| guarded_personalized | 5 | 0.8824 | 0.1568 | 0.9608 | 0.8757 | 0.1356 | 819.23 |
| guarded_personalized | 10 | 0.8706 | 0.2748 | 0.9608 | 0.8888 | 0.1371 | 819.23 |
| guarded_personalized | 20 | 0.8059 | 0.4108 | 0.9608 | 0.8888 | 0.1423 | 819.23 |

Improved relevance versus legacy MMR; diversity lower than legacy and nearly equal to semantic baseline. Diversity improvement versus semantic is not established by the confidence interval. No claim of real-user correctness.

Exploratory: only 5 validation profiles for 144 configurations. Test excluded from this parameter selection; previous aggregate benchmark already contained these test profiles, so this is not a newly collected unseen confirmation set.
