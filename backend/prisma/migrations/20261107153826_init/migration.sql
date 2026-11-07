-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `emailVerifiedAt` DATETIME(3) NULL,
    `dataPolicyAcceptedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Address` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `label` VARCHAR(60) NULL,
    `department` VARCHAR(60) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `addressLine` VARCHAR(200) NOT NULL,
    `neighborhood` VARCHAR(100) NULL,
    `notes` VARCHAR(300) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Address_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(128) NOT NULL,
    `data` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` VARCHAR(300) NULL,
    `imageUrl` VARCHAR(300) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Collection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `imageUrl` VARCHAR(300) NULL,
    `isDrop` BOOLEAN NOT NULL DEFAULT false,
    `releaseDate` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Collection_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` TEXT NOT NULL,
    `materials` TEXT NULL,
    `care` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `compareAtPrice` DECIMAL(12, 2) NULL,
    `gender` ENUM('HOMBRE', 'MUJER', 'UNISEX') NOT NULL DEFAULT 'UNISEX',
    `categoryId` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `isNew` BOOLEAN NOT NULL DEFAULT false,
    `isBestSeller` BOOLEAN NOT NULL DEFAULT false,
    `salesCount` INTEGER NOT NULL DEFAULT 0,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_active_createdAt_idx`(`active`, `createdAt`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_gender_idx`(`gender`),
    INDEX `Product_price_idx`(`price`),
    FULLTEXT INDEX `Product_name_description_idx`(`name`, `description`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `url` VARCHAR(300) NOT NULL,
    `storageKey` VARCHAR(300) NOT NULL,
    `alt` VARCHAR(200) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductImage_productId_sortOrder_idx`(`productId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `color` VARCHAR(40) NOT NULL,
    `colorHex` VARCHAR(7) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductVariant_sku_key`(`sku`),
    INDEX `ProductVariant_size_idx`(`size`),
    INDEX `ProductVariant_color_idx`(`color`),
    UNIQUE INDEX `ProductVariant_productId_size_color_key`(`productId`, `size`, `color`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cart` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cart_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cartId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CartItem_cartId_variantId_key`(`cartId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderNumber` VARCHAR(20) NOT NULL,
    `userId` INTEGER NULL,
    `status` ENUM('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
    `paymentStatus` ENUM('PENDIENTE', 'PAGADO', 'REEMBOLSADO') NOT NULL DEFAULT 'PENDIENTE',
    `customerName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `department` VARCHAR(60) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `address` VARCHAR(200) NOT NULL,
    `neighborhood` VARCHAR(100) NULL,
    `deliveryNotes` VARCHAR(300) NULL,
    `shareAddressWhatsapp` BOOLEAN NOT NULL DEFAULT false,
    `shippingMethodName` VARCHAR(80) NULL,
    `paymentMethod` VARCHAR(60) NULL,
    `promotionCode` VARCHAR(40) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `shippingCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `shippingDefined` BOOLEAN NOT NULL DEFAULT false,
    `total` DECIMAL(12, 2) NOT NULL,
    `idempotencyKey` VARCHAR(64) NOT NULL,
    `accessTokenHash` VARCHAR(64) NOT NULL,
    `dataPolicyAcceptedAt` DATETIME(3) NOT NULL,
    `reservationExpiresAt` DATETIME(3) NULL,
    `stockReleased` BOOLEAN NOT NULL DEFAULT false,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `Order_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    INDEX `Order_email_idx`(`email`),
    INDEX `Order_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `variantId` INTEGER NULL,
    `productName` VARCHAR(120) NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `color` VARCHAR(40) NOT NULL,
    `imageUrl` VARCHAR(300) NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotal` DECIMAL(12, 2) NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderStatusHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `fromStatus` ENUM('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO') NULL,
    `toStatus` ENUM('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO') NOT NULL,
    `note` VARCHAR(300) NULL,
    `changedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusHistory_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `authorId` INTEGER NULL,
    `body` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderNote_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variantId` INTEGER NOT NULL,
    `type` ENUM('STOCK_INICIAL', 'AJUSTE_ADMIN', 'RESERVA_PEDIDO', 'LIBERACION_PEDIDO') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `stockAfter` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `userId` INTEGER NULL,
    `reason` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryMovement_variantId_createdAt_idx`(`variantId`, `createdAt`),
    INDEX `InventoryMovement_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `description` VARCHAR(200) NULL,
    `type` ENUM('PORCENTAJE', 'VALOR_FIJO') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `minSubtotal` DECIMAL(12, 2) NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `maxUses` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Promotion_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingMethod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(200) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreSetting` (
    `key` VARCHAR(60) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(60) NULL,
    `details` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_CollectionToProduct` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_CollectionToProduct_AB_unique`(`A`, `B`),
    INDEX `_CollectionToProduct_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderNote` ADD CONSTRAINT `OrderNote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderNote` ADD CONSTRAINT `OrderNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CollectionToProduct` ADD CONSTRAINT `_CollectionToProduct_A_fkey` FOREIGN KEY (`A`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CollectionToProduct` ADD CONSTRAINT `_CollectionToProduct_B_fkey` FOREIGN KEY (`B`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
