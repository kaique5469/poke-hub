CREATE TABLE `binder_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setName` varchar(256),
	`setId` varchar(64),
	`imageUrl` text,
	`rarity` varchar(128),
	`quantity` int NOT NULL DEFAULT 1,
	`condition` enum('NM','LP','MP','HP','D') NOT NULL DEFAULT 'NM',
	`notes` text,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `binder_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deck_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deckId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`setName` varchar(256),
	`setId` varchar(64),
	`imageUrl` text,
	`supertype` varchar(64),
	`quantity` int NOT NULL DEFAULT 1,
	`priceUsd` decimal(10,2),
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deck_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`format` enum('standard','expanded','unlimited') NOT NULL DEFAULT 'standard',
	`isPublic` boolean NOT NULL DEFAULT false,
	`estimatedCostUsd` decimal(10,2),
	`cardCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drop_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productName` varchar(512) NOT NULL,
	`retailer` enum('pokemon_center','amazon','target') NOT NULL,
	`productUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`pushSubscription` json,
	`lastChecked` timestamp,
	`lastTriggered` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drop_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`tcgLow` decimal(10,2),
	`tcgMid` decimal(10,2),
	`tcgHigh` decimal(10,2),
	`tcgMarket` decimal(10,2),
	`tcgDirectLow` decimal(10,2),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_cache_cardId_unique` UNIQUE(`cardId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);