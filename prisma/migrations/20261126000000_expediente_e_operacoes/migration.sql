-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `aberturaMin` INTEGER NOT NULL DEFAULT 540,
    ADD COLUMN `diasFuncionamento` JSON NULL,
    ADD COLUMN `fechamentoMin` INTEGER NOT NULL DEFAULT 1140,
    ADD COLUMN `fusoHorario` VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE `agendamentos` ADD COLUMN `chaveOperacao` VARCHAR(36) NULL,
    ADD COLUMN `hashPedido` CHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `agendamentos_empresaId_chaveOperacao_key` ON `agendamentos`(`empresaId`, `chaveOperacao`);

-- Preencher empresas existentes antes de exigir o JSON.
UPDATE empresas SET diasFuncionamento = JSON_ARRAY(1,2,3,4,5,6) WHERE diasFuncionamento IS NULL;
ALTER TABLE empresas MODIFY diasFuncionamento JSON NOT NULL DEFAULT (JSON_ARRAY(1,2,3,4,5,6));
