import { z } from 'zod';

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);

const password = z
  .string()
  .min(6, "A senha precisa ter pelo menos 6 caracteres.")
  .max(128);

export const authSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    username,
    password: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("mobileLogin"),
    username,
    password: z.string().min(1).max(128),
  }),
  z.object({ action: z.literal("logout") }),
  z.object({
    action: z.literal("password"),
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
  }),
]);


export type AuthAction = z.infer<typeof authSchema>;
