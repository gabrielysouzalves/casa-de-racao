-- Casa de Racoes - vs1

CREATE DATABASE IF NOT EXISTS casa_de_racao
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE casa_de_racao;

CREATE TABLE IF NOT EXISTS produtos (
  produto_cod VARCHAR(191) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  codigo_barras VARCHAR(191) DEFAULT NULL,
  preco BIGINT NOT NULL,
  quantidade BIGINT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 5,
  PRIMARY KEY (produto_cod),
  UNIQUE KEY uk_produtos_codigo_barras (codigo_barras),
  CONSTRAINT chk_produtos_preco CHECK (preco >= 0),
  CONSTRAINT chk_produtos_quantidade CHECK (quantidade >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  usuario_cod VARCHAR(191) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  nome_usuario VARCHAR(191) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(100) NOT NULL,
  ativo TINYINT NOT NULL DEFAULT 1,
  deve_alterar_senha TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_cod),
  UNIQUE KEY uk_usuarios_nome_usuario (nome_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contas_pagar (
  conta_cod VARCHAR(191) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  empresa VARCHAR(255) NOT NULL DEFAULT '',
  mei VARCHAR(255) NOT NULL DEFAULT '',
  data DATE NOT NULL,
  valor BIGINT NOT NULL,
  pago TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conta_cod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS limites_login (
  chave VARCHAR(191) NOT NULL,
  tentativas INT NOT NULL,
  expira_em BIGINT NOT NULL,
  PRIMARY KEY (chave),
  KEY idx_limites_login_expiracao (expira_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimentacoes (
  movimentacao_cod VARCHAR(191) NOT NULL,
  produto_cod VARCHAR(191) NOT NULL,
  nome_produto VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  quantidade BIGINT NOT NULL,
  preco BIGINT NOT NULL,
  data DATETIME NOT NULL,
  venda_cod VARCHAR(191) DEFAULT NULL,
  observacao TEXT NOT NULL,
  PRIMARY KEY (movimentacao_cod),
  KEY fk_movimentacoes_produto (produto_cod),
  CONSTRAINT fk_movimentacoes_produto
    FOREIGN KEY (produto_cod) REFERENCES produtos (produto_cod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash CHAR(64) NOT NULL,
  usuario_cod VARCHAR(191) NOT NULL,
  expira_em BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessoes_usuario (usuario_cod),
  KEY idx_sessoes_expiracao (expira_em),
  CONSTRAINT fk_sessoes_usuario
    FOREIGN KEY (usuario_cod) REFERENCES usuarios (usuario_cod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER trg_movimentacoes_atualizar_estoque
BEFORE INSERT ON movimentacoes
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.tipo = 'in' AND NEW.quantidade > 0) OR
    (NEW.tipo IN ('out', 'sale') AND NEW.quantidade < 0)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Tipo ou quantidade de movimentacao invalida';
  END IF;

  UPDATE produtos
     SET quantidade = quantidade + NEW.quantidade
   WHERE produto_cod = NEW.produto_cod
     AND quantidade + NEW.quantidade >= 0;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Produto inexistente ou estoque insuficiente';
  END IF;
END$$
DELIMITER ;
