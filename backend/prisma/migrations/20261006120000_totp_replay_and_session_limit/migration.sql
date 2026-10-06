ALTER TABLE "MfaSettings"
ADD COLUMN "lastUsedTotpStep" INTEGER;

-- Los tokens previos tenían una ventana de siete días y no guardan el inicio
-- de sesión. Se revocan para que ningún token heredado eluda el nuevo límite
-- absoluto de 30 minutos.
UPDATE "RefreshToken"
SET "revokedAt" = NOW()
WHERE "revokedAt" IS NULL;
