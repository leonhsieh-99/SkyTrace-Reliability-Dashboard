## About

When operating a global constellation of autonomous sensors, operators need to quickly identify which sensors require attention and why — without manually inspecting raw telemetry. 

This project explores how to monitor and triage the health of a global sensor constellation using only sparse, noisy telemetry. It focuses on identifying reliability risks, distinguishing data corruption from environmental stress, and presenting actionable signals to operators.

This project tries to answer
1. Which sensors are unhealthy right now ?
2. Are anomalies likely due to data corruption or environmental stress ?
3. Where should human attention go first ?

## Stack
Frontend: React, Next.js
DB: PostrgreSQL
ORM: Prisma