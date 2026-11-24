import { z } from 'zod';
import { requireUser, ensureOrigin, AuthError, authFailure, privateJson } from '@/lib/auth';
import { schema } from '@/lib/services/StoreSchema';
import { storeService } from '@/lib/services/StoreService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return privateJson(await storeService.load());
  } catch (e) {
    if (e instanceof AuthError) {
      return authFailure(e, request);
    }

    console.error(e);

    return privateJson(
      { error: "Não foi possível carregar os dados. Tente novamente." },
      503
    );
  }
}


export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);
    const value = schema.parse(await request.json());
    return privateJson(await storeService.save(value));
  } catch (e) {
    if (e instanceof AuthError) {
      return authFailure(e, request);
    }

    if (e instanceof z.ZodError) {
      return privateJson(
        { error: "Confira os campos informados." },
        400
      );
    }

    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String(e.code)
        : "";

    const errno =
      typeof e === "object" && e !== null && "errno" in e
        ? Number(e.errno)
        : 0;

    if (code === "ER_DUP_ENTRY") {
      return privateJson(
        { error: "Este código de barras já está cadastrado." },
        400
      );
    }

    if (errno === 3819) {
      return privateJson(
        { error: "Estoque insuficiente. A operação não foi registrada." },
        400
      );
    }

    const message = e instanceof Error ? e.message : String(e);

    if (message.includes("Preencha")) {
      return privateJson(
        { error: "Preencha a razão social e o MEI." },
        400
      );
    }

    if (message.includes("Produto não encontrado")) {
      return privateJson(
        { error: "Produto não encontrado." },
        400
      );
    }

    console.error("Erro ao salvar dados:", e);

    return privateJson(
      { error: "Não foi possível salvar. Confira os dados e tente novamente." },
      400
    );
  }
}
