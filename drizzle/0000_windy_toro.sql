CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`mei` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`date` text NOT NULL,
	`sale_id` text,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`barcode` text,
	`price` integer NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`minimum` integer DEFAULT 5 NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("products"."quantity" >= 0),
	CONSTRAINT "price_nonnegative" CHECK("products"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode` ON `products` (`barcode`);
--> statement-breakpoint
CREATE TRIGGER stock_on_movement AFTER INSERT ON movements
BEGIN
 UPDATE products SET quantity = quantity + NEW.quantity WHERE id = NEW.product_id;
END;
