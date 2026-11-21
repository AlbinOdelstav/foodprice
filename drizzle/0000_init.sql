CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store` text NOT NULL,
	`store_product_id` text NOT NULL,
	`store_location` text DEFAULT '' NOT NULL,
	`url` text,
	`name` text NOT NULL,
	`brand` text,
	`image_url` text,
	`base_unit` text DEFAULT 'g' NOT NULL,
	`package_size` real,
	`pieces` real,
	`piece_size` real,
	`price_basis` text DEFAULT 'package' NOT NULL,
	`price` real NOT NULL,
	`offers` text DEFAULT '[]' NOT NULL,
	`nutrition` text,
	`overrides` text DEFAULT '[]' NOT NULL,
	`fetched_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_store_ref` ON `products` (`store`,`store_product_id`,`store_location`);--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `recipe_items_recipe` ON `recipe_items` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_items_product` ON `recipe_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`servings` real DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
