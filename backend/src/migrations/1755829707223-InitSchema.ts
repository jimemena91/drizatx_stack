import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1755829707223 implements MigrationInterface {
    name = 'InitSchema1755829707223'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`services\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`name\` varchar(100) NOT NULL, \`prefix\` varchar(10) NOT NULL, \`active\` tinyint(1) NOT NULL DEFAULT '1', \`priority\` int NOT NULL DEFAULT '1', \`estimated_time\` int NOT NULL DEFAULT '10', \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE INDEX \`IDX_2c9c23101a39870840b9777fe5\` (\`prefix\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`operators\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(100) NOT NULL, \`username\` varchar(50) NOT NULL, \`email\` varchar(150) NULL, \`password_hash\` varchar(255) NULL, \`position\` varchar(50) NULL, \`role\` varchar(30) NOT NULL DEFAULT 'OPERATOR', \`active\` tinyint(1) NOT NULL DEFAULT '1', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_34c09a69a635282ea722970309\` (\`username\`), UNIQUE INDEX \`IDX_1570f3d85c3ff08bb99815897a\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`clients\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`dni\` varchar(20) NOT NULL, \`name\` varchar(100) NOT NULL, \`email\` varchar(100) NULL, \`phone\` varchar(20) NULL, \`vip\` tinyint(1) NOT NULL DEFAULT '0', \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE INDEX \`IDX_8e645da308339e84f45d6cfe5d\` (\`dni\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`tickets\` (  \`id\` int NOT NULL AUTO_INCREMENT,\`number\` varchar(20) NOT NULL,\`service_id\` int UNSIGNED NOT NULL,\`operator_id\` int NULL,\`client_id\` int UNSIGNED NULL,\`status\` enum ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'WAITING',\`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,\`called_at\` timestamp NULL,\`started_at\` timestamp NULL,\`completed_at\` timestamp NULL,
  \`priority\` int NOT NULL DEFAULT '1',
  \`estimated_wait_time\` int NULL,
  \`actual_wait_time\` int NULL,
  \`mobile_phone\` varchar(20) NULL,
  \`notification_sent\` tinyint NOT NULL DEFAULT '0',
  \`qr_scanned_at\` timestamp NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB`);

        await queryRunner.query(`CREATE TABLE \`system_settings\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`key\` varchar(100) NOT NULL, \`value\` text NOT NULL, \`description\` text NULL, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE INDEX \`IDX_b1b5bc664526d375c94ce9ad43\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`tickets\` ADD CONSTRAINT \`FK_e460ec1588e906d63ce17f514d8\` FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`tickets\` ADD CONSTRAINT \`FK_d231bdd04d454233482d9b91688\` FOREIGN KEY (\`operator_id\`) REFERENCES \`operators\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`tickets\` ADD CONSTRAINT \`FK_ab0f4c7161f0a5c178d229e3541\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`tickets\` DROP FOREIGN KEY \`FK_ab0f4c7161f0a5c178d229e3541\``);
        await queryRunner.query(`ALTER TABLE \`tickets\` DROP FOREIGN KEY \`FK_d231bdd04d454233482d9b91688\``);
        await queryRunner.query(`ALTER TABLE \`tickets\` DROP FOREIGN KEY \`FK_e460ec1588e906d63ce17f514d8\``);
        await queryRunner.query(`DROP INDEX \`IDX_b1b5bc664526d375c94ce9ad43\` ON \`system_settings\``);
        await queryRunner.query(`DROP TABLE \`system_settings\``);
        await queryRunner.query(`DROP TABLE \`tickets\``);
        await queryRunner.query(`DROP INDEX \`IDX_8e645da308339e84f45d6cfe5d\` ON \`clients\``);
        await queryRunner.query(`DROP TABLE \`clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_1570f3d85c3ff08bb99815897a\` ON \`operators\``);
        await queryRunner.query(`DROP INDEX \`IDX_34c09a69a635282ea722970309\` ON \`operators\``);
        await queryRunner.query(`DROP TABLE \`operators\``);
        await queryRunner.query(`DROP INDEX \`IDX_2c9c23101a39870840b9777fe5\` ON \`services\``);
        await queryRunner.query(`DROP TABLE \`services\``);
    }

}

