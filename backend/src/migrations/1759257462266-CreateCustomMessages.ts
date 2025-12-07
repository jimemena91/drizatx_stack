import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomMessages1759257462266 implements MigrationInterface {
    name = 'CreateCustomMessages1759257462266'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`custom_messages\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`title\` varchar(150) NOT NULL, \`content\` text NOT NULL, \`type\` varchar(30) NOT NULL DEFAULT 'info', \`active\` tinyint(1) NOT NULL DEFAULT '1', \`priority\` int NOT NULL DEFAULT '1', \`start_date\` datetime NULL, \`end_date\` datetime NULL, \`media_url\` varchar(255) NULL, \`media_type\` varchar(50) NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`custom_messages\``);
    }

}
