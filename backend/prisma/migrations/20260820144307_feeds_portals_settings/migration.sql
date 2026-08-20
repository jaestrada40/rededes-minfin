-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaThumb" TEXT,
    "videoDuration" TEXT,
    "stats" JSONB,
    "isValidated" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "layoutDefault" TEXT NOT NULL DEFAULT 'grid',
    "maxItemsDefault" INTEGER NOT NULL DEFAULT 6,
    "showMetrics" BOOLEAN NOT NULL DEFAULT true,
    "showMedia" BOOLEAN NOT NULL DEFAULT true,
    "autoRefreshMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPost" (
    "feedId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("feedId","postId")
);

-- CreateTable
CREATE TABLE "WordPressPortal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'connected',
    "ipAddress" TEXT NOT NULL,
    "wpVersion" TEXT NOT NULL,
    "pluginVersion" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenValid" BOOLEAN NOT NULL DEFAULT true,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,

    CONSTRAINT "WordPressPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPortal" (
    "feedId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,

    CONSTRAINT "FeedPortal_pkey" PRIMARY KEY ("feedId","portalId")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "institutionName" TEXT NOT NULL DEFAULT 'Ministerio de Finanzas Públicas',
    "shortcodeTag" TEXT NOT NULL DEFAULT 'minfin_social_feed',
    "apiCacheDurationSeconds" INTEGER NOT NULL DEFAULT 300,
    "webhookSecret" TEXT NOT NULL,
    "autoInvalidateCache" BOOLEAN NOT NULL DEFAULT true,
    "allowedCorsDomains" TEXT[],
    "officialAccounts" JSONB NOT NULL,
    "contactSupportEmail" TEXT NOT NULL DEFAULT 'soporte.dti@minfin.gob.gt',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_network_postId_key" ON "SocialPost"("network", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WordPressPortal_domain_key" ON "WordPressPortal"("domain");

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPortal" ADD CONSTRAINT "FeedPortal_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPortal" ADD CONSTRAINT "FeedPortal_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "WordPressPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
