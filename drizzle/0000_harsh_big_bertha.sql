CREATE TABLE `recipes` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`revision` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`payload` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
