-- Parte 3: executar com a API parada e backup conferido.
-- O MySQL faz commits implicitos de DDL. Nenhuma tabela de negocio e alterada
-- antes das verificacoes abaixo. Nao atribuir orfaos a uma empresa arbitraria.
CREATE TEMPORARY TABLE `_validacao_parte3` (
  `empresas_ok` INT NOT NULL CONSTRAINT `sanear_empresas_obrigatorias` CHECK (`empresas_ok` = 1),
  `vinculos_ok` INT NOT NULL CONSTRAINT `sanear_vinculos_entre_empresas` CHECK (`vinculos_ok` = 1),
  `valores_ok` INT NOT NULL CONSTRAINT `sanear_precos_e_duracoes` CHECK (`valores_ok` = 1),
  `telefones_ok` INT NOT NULL CONSTRAINT `sanear_telefones_invalidos_ou_duplicados` CHECK (`telefones_ok` = 1)
) ENGINE=InnoDB;

INSERT INTO `_validacao_parte3`
SELECT
  NOT EXISTS (
    SELECT 1 FROM `clientes` c LEFT JOIN `empresas` e ON e.id = c.empresaId WHERE e.id IS NULL
    UNION ALL
    SELECT 1 FROM `profissionais` p LEFT JOIN `empresas` e ON e.id = p.empresaId WHERE e.id IS NULL
    UNION ALL
    SELECT 1 FROM `servicos` s LEFT JOIN `empresas` e ON e.id = s.empresaId WHERE e.id IS NULL
    UNION ALL
    SELECT 1 FROM `agendamentos` a LEFT JOIN `empresas` e ON e.id = a.empresaId WHERE e.id IS NULL
  ),
  NOT EXISTS (
    SELECT 1 FROM `agendamentos` a
      LEFT JOIN `clientes` c ON c.id = a.clienteId
      LEFT JOIN `profissionais` p ON p.id = a.profissionalId
      WHERE c.id IS NULL OR p.id IS NULL OR c.empresaId <> a.empresaId OR p.empresaId <> a.empresaId
    UNION ALL
    SELECT 1 FROM `agendamento_servicos` item
      LEFT JOIN `agendamentos` a ON a.id = item.agendamentoId
      LEFT JOIN `servicos` s ON s.id = item.servicoId
      WHERE a.id IS NULL OR s.id IS NULL OR a.empresaId <> s.empresaId
  ),
  NOT EXISTS (
    SELECT 1 FROM `servicos`
      WHERE preco < 0.01 OR preco > 99999999.99 OR ABS(preco - ROUND(preco, 2)) > 0.0000001
        OR duracaoMin < 5 OR duracaoMin > 600
    UNION ALL
    SELECT 1 FROM `agendamento_servicos`
      WHERE precoCobrado < 0.01 OR precoCobrado > 99999999.99
        OR ABS(precoCobrado - ROUND(precoCobrado, 2)) > 0.0000001
  ),
  NOT EXISTS (
    SELECT 1 FROM `clientes`
      WHERE telefone NOT REGEXP '^[0-9[:space:]()+.-]+$'
    UNION ALL
    SELECT 1 FROM (
      SELECT empresaId,
        CASE WHEN LENGTH(digitos) IN (12, 13) AND LEFT(digitos, 2) = '55'
          THEN SUBSTRING(digitos, 3) ELSE digitos END AS normalizado
      FROM (
        SELECT empresaId, REGEXP_REPLACE(telefone, '[^0-9]', '') AS digitos
        FROM `clientes`
      ) AS digitos_cliente
    ) AS telefone_cliente
    GROUP BY empresaId, normalizado
    HAVING LENGTH(normalizado) NOT IN (10, 11) OR COUNT(*) > 1
  );

DROP TEMPORARY TABLE `_validacao_parte3`;

-- Normalizar somente apos verificar colisoes e entradas invalidas.
UPDATE `clientes`
SET telefone = CASE
  WHEN LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '')) IN (12, 13)
    AND LEFT(REGEXP_REPLACE(telefone, '[^0-9]', ''), 2) = '55'
  THEN SUBSTRING(REGEXP_REPLACE(telefone, '[^0-9]', ''), 3)
  ELSE REGEXP_REPLACE(telefone, '[^0-9]', '')
END;

-- Expandir com campos opcionais, preencher e so depois tornar obrigatorios.
ALTER TABLE `agendamento_servicos`
  ADD COLUMN `empresaId` INTEGER NULL,
  ADD COLUMN `nomeContratado` VARCHAR(191) NULL,
  ADD COLUMN `duracaoContratadaMin` INTEGER NULL;

-- O preco historico ja existente e preservado. Nome e duracao antigos nao
-- existiam na base: recebem o catalogo atual, sem reconstruir valores perdidos.
UPDATE `agendamento_servicos` item
  JOIN `agendamentos` a ON a.id = item.agendamentoId
  JOIN `servicos` s ON s.id = item.servicoId
SET item.empresaId = a.empresaId,
    item.nomeContratado = s.nome,
    item.duracaoContratadaMin = s.duracaoMin;

-- DropForeignKey
ALTER TABLE `clientes` DROP FOREIGN KEY `clientes_empresaId_fkey`;

-- DropForeignKey
ALTER TABLE `profissionais` DROP FOREIGN KEY `profissionais_empresaId_fkey`;

-- DropForeignKey
ALTER TABLE `servicos` DROP FOREIGN KEY `servicos_empresaId_fkey`;

-- DropForeignKey
ALTER TABLE `agendamentos` DROP FOREIGN KEY `agendamentos_empresaId_fkey`;

-- DropForeignKey
ALTER TABLE `agendamentos` DROP FOREIGN KEY `agendamentos_clienteId_fkey`;

-- DropForeignKey
ALTER TABLE `agendamentos` DROP FOREIGN KEY `agendamentos_profissionalId_fkey`;

-- DropForeignKey
ALTER TABLE `agendamento_servicos` DROP FOREIGN KEY `agendamento_servicos_servicoId_fkey`;

-- DropForeignKey
ALTER TABLE `agendamento_servicos` DROP FOREIGN KEY `agendamento_servicos_agendamentoId_fkey`;

-- AlterTable
ALTER TABLE `clientes` MODIFY `empresaId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `profissionais` MODIFY `empresaId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `servicos` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `preco` DECIMAL(10, 2) NOT NULL,
    MODIFY `empresaId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `agendamentos` MODIFY `empresaId` INTEGER NOT NULL,
    MODIFY `clienteId` INTEGER NOT NULL,
    MODIFY `profissionalId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `agendamento_servicos` MODIFY `duracaoContratadaMin` INTEGER NOT NULL,
    MODIFY `empresaId` INTEGER NOT NULL,
    MODIFY `nomeContratado` VARCHAR(191) NOT NULL,
    MODIFY `precoCobrado` DECIMAL(10, 2) NOT NULL;

-- CreateIndex
CREATE INDEX `clientes_empresaId_nome_id_idx` ON `clientes`(`empresaId`, `nome`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `clientes_id_empresaId_key` ON `clientes`(`id`, `empresaId`);

-- CreateIndex
CREATE INDEX `profissionais_empresaId_ativo_nome_id_idx` ON `profissionais`(`empresaId`, `ativo`, `nome`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `profissionais_id_empresaId_key` ON `profissionais`(`id`, `empresaId`);

-- CreateIndex
CREATE INDEX `servicos_empresaId_ativo_nome_id_idx` ON `servicos`(`empresaId`, `ativo`, `nome`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `servicos_id_empresaId_key` ON `servicos`(`id`, `empresaId`);

-- CreateIndex
CREATE INDEX `agendamentos_empresaId_status_inicio_id_idx` ON `agendamentos`(`empresaId`, `status`, `inicio`, `id`);

-- CreateIndex
CREATE INDEX `agendamentos_empresaId_profissionalId_inicio_fim_idx` ON `agendamentos`(`empresaId`, `profissionalId`, `inicio`, `fim`);

-- CreateIndex
CREATE INDEX `agendamentos_clienteId_empresaId_idx` ON `agendamentos`(`clienteId`, `empresaId`);

-- CreateIndex
CREATE INDEX `agendamentos_profissionalId_empresaId_idx` ON `agendamentos`(`profissionalId`, `empresaId`);

-- CreateIndex
CREATE UNIQUE INDEX `agendamentos_id_empresaId_key` ON `agendamentos`(`id`, `empresaId`);

-- CreateIndex
CREATE INDEX `agendamento_servicos_servicoId_empresaId_idx` ON `agendamento_servicos`(`servicoId`, `empresaId`);

-- CreateIndex
CREATE INDEX `agendamento_servicos_agendamentoId_empresaId_idx` ON `agendamento_servicos`(`agendamentoId`, `empresaId`);

-- AddForeignKey
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `profissionais` ADD CONSTRAINT `profissionais_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `servicos` ADD CONSTRAINT `servicos_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_clienteId_empresaId_fkey` FOREIGN KEY (`clienteId`, `empresaId`) REFERENCES `clientes`(`id`, `empresaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_profissionalId_empresaId_fkey` FOREIGN KEY (`profissionalId`, `empresaId`) REFERENCES `profissionais`(`id`, `empresaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `agendamento_servicos` ADD CONSTRAINT `agendamento_servicos_servicoId_empresaId_fkey` FOREIGN KEY (`servicoId`, `empresaId`) REFERENCES `servicos`(`id`, `empresaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `agendamento_servicos` ADD CONSTRAINT `agendamento_servicos_agendamentoId_empresaId_fkey` FOREIGN KEY (`agendamentoId`, `empresaId`) REFERENCES `agendamentos`(`id`, `empresaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
