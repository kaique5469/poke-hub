CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`subtitle` text,
	`slug` varchar(512) NOT NULL,
	`coverImageUrl` text,
	`content` text NOT NULL,
	`category` enum('strategy','deck_guide','set_review','tournament','collector','news') NOT NULL DEFAULT 'news',
	`tags` json,
	`viewCount` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `auction_bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`bidderId` int NOT NULL,
	`amountUsd` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auction_watches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_watches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`cardId` varchar(64),
	`cardName` varchar(256),
	`setId` varchar(64),
	`setName` varchar(256),
	`imageUrl` text,
	`condition` enum('M','NM','SP','MP','HP','D') NOT NULL DEFAULT 'NM',
	`language` varchar(32) NOT NULL DEFAULT 'English',
	`isFoil` boolean NOT NULL DEFAULT false,
	`isPromo` boolean NOT NULL DEFAULT false,
	`isFirstEdition` boolean NOT NULL DEFAULT false,
	`startingBidUsd` decimal(10,2) NOT NULL,
	`currentBidUsd` decimal(10,2),
	`fixedPriceUsd` decimal(10,2),
	`buyerProtection` boolean NOT NULL DEFAULT false,
	`bidCount` int NOT NULL DEFAULT 0,
	`watchCount` int NOT NULL DEFAULT 0,
	`endsAt` timestamp NOT NULL,
	`status` enum('active','ended','cancelled') NOT NULL DEFAULT 'active',
	`winnerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banner_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256),
	`subtitle` text,
	`imageUrl` text NOT NULL,
	`linkUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `banner_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bazaar_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setId` varchar(64),
	`setName` varchar(256),
	`imageUrl` text,
	`quantity` int NOT NULL DEFAULT 1,
	`condition` enum('M','NM','SP','MP','HP','D') NOT NULL DEFAULT 'NM',
	`language` varchar(32) DEFAULT 'English',
	`priceUsd` decimal(10,2),
	`isForTrade` boolean NOT NULL DEFAULT true,
	`isForSale` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bazaar_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `binders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`coverImageUrl` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`totalValueUsd` decimal(10,2) DEFAULT '0.00',
	`cardCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `binders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buy_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setId` varchar(64),
	`setName` varchar(256),
	`imageUrl` text,
	`quantity` int NOT NULL DEFAULT 1,
	`condition` enum('M','NM','SP','MP','HP','D') NOT NULL DEFAULT 'NM',
	`language` varchar(32) DEFAULT 'English',
	`maxPriceUsd` decimal(10,2),
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `buy_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`listingId` int,
	`productListingId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entityType` enum('card','product','article','deck','auction') NOT NULL,
	`entityId` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setId` varchar(64),
	`setName` varchar(256),
	`imageUrl` text,
	`condition` enum('M','NM','SP','MP','HP','D') NOT NULL,
	`language` varchar(32) NOT NULL DEFAULT 'English',
	`priceUsd` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`isFoil` boolean NOT NULL DEFAULT false,
	`isAltered` boolean NOT NULL DEFAULT false,
	`isFirstEdition` boolean NOT NULL DEFAULT false,
	`notes` text,
	`status` enum('active','sold','cancelled') NOT NULL DEFAULT 'active',
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('auction_bid','auction_won','order_update','price_alert','drop_alert','bazaar_match') NOT NULL,
	`title` varchar(256) NOT NULL,
	`message` text NOT NULL,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyerId` int NOT NULL,
	`sellerId` int NOT NULL,
	`listingId` int,
	`productListingId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`totalUsd` decimal(10,2) NOT NULL,
	`status` enum('pending','paid','shipped','delivered','cancelled','disputed') NOT NULL DEFAULT 'pending',
	`buyerProtection` boolean NOT NULL DEFAULT false,
	`trackingNumber` varchar(256),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`tcgMarket` decimal(10,2),
	`tcgLow` decimal(10,2),
	`tcgHigh` decimal(10,2),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`sellerId` int NOT NULL,
	`priceUsd` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`condition` enum('M','NM','SP','MP','HP','D') NOT NULL DEFAULT 'NM',
	`language` varchar(32) DEFAULT 'English',
	`notes` text,
	`status` enum('active','sold','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`slug` varchar(512) NOT NULL,
	`description` text,
	`imageUrl` text,
	`category` enum('booster_pack','booster_box','etb','tin','blister','theme_deck','pre_release','collector_box','battle_deck','world_championship','plush','miniature','apparel','trainer_kit','empty_box','playmat','damage_counter','sleeves','deck_box','pin','coin','binder_portfolio') NOT NULL,
	`language` varchar(32) DEFAULT 'English',
	`setId` varchar(64),
	`setName` varchar(256),
	`minPriceUsd` decimal(10,2),
	`avgPriceUsd` decimal(10,2),
	`maxPriceUsd` decimal(10,2),
	`viewCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `seller_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`orderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `want_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setId` varchar(64),
	`imageUrl` text,
	`quantity` int NOT NULL DEFAULT 1,
	`condition` enum('M','NM','SP','MP','HP','D') DEFAULT 'NM',
	`maxPriceUsd` decimal(10,2),
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `want_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `binder_cards` MODIFY COLUMN `condition` enum('M','NM','SP','MP','HP','D') NOT NULL DEFAULT 'NM';--> statement-breakpoint
ALTER TABLE `decks` MODIFY COLUMN `format` enum('standard','expanded','unlimited','glc') NOT NULL DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE `binder_cards` ADD `binderId` int;--> statement-breakpoint
ALTER TABLE `binder_cards` ADD `language` varchar(32) DEFAULT 'English';--> statement-breakpoint
ALTER TABLE `decks` ADD `minCostUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `decks` ADD `maxCostUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `decks` ADD `viewCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `decks` ADD `featuredCards` json;--> statement-breakpoint
ALTER TABLE `users` ADD `location` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `sellerRating` decimal(3,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `users` ADD `totalSales` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isVerifiedSeller` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `hasPhysicalStore` boolean DEFAULT false NOT NULL;