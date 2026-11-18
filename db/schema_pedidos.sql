CREATE TABLE IF NOT EXISTS pedidos (
    pedido_cod VARCHAR(191) NOT NULL,
    tipo ENUM('PRESENCIAL', 'ENTREGA') NOT NULL,
    status ENUM(
        'AGUARDANDO',
        'EM_ATENDIMENTO',
        'CONCLUIDO',
        'CANCELADO'
    ) NOT NULL DEFAULT 'AGUARDANDO',
    criado_em DATETIME(3) NOT NULL,
    iniciado_em DATETIME(3) DEFAULT NULL,
    concluido_em DATETIME(3) DEFAULT NULL,
    cancelado_em DATETIME(3) DEFAULT NULL,

    PRIMARY KEY (pedido_cod),
    INDEX idx_pedidos_status (status),
    INDEX idx_pedidos_criado_em (criado_em)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;