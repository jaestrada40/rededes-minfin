-- Elimina campos de metadata de portal que nunca se sincronizaban con la
-- realidad (IP, versión de WordPress, versión de plugin) y no cumplían
-- ninguna función más allá de anotación manual.
ALTER TABLE "WordPressPortal" DROP COLUMN "ipAddress";
ALTER TABLE "WordPressPortal" DROP COLUMN "wpVersion";
ALTER TABLE "WordPressPortal" DROP COLUMN "pluginVersion";
