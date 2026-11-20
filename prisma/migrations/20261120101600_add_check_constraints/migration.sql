-- CHECK constraint yang tidak dimodelkan Prisma (docs/schema.sql).
-- Ditambahkan lewat migration terpisah agar `migrate dev` tetap bersih.

ALTER TABLE `users`
  ADD CONSTRAINT `chk_rank` CHECK (`rank_jabatan` BETWEEN 1 AND 3);

ALTER TABLE `criteria`
  ADD CONSTRAINT `chk_bobot` CHECK (`bobot` > 0 AND `bobot` <= 100);

ALTER TABLE `assessments`
  ADD CONSTRAINT `chk_nilai` CHECK (`nilai` > 0);
