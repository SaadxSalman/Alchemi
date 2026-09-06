/** Auth router — register, login, and current-user profile. */
import { z } from "zod";
import { publicProcedure, authenticatedProcedure, router } from "../trpc";
import { registerUser, loginUser } from "../../auth";
import { logger } from "../../logger";

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

export const authRouter = router({
  register: publicProcedure
    .input(credentialsSchema)
    .mutation(async ({ input }) => {
      const result = await registerUser(input.email, input.password);
      logger.info({ email: input.email }, "auth.register");
      return result;
    }),

  login: publicProcedure
    .input(credentialsSchema)
    .mutation(async ({ input }) => {
      const result = await loginUser(input.email, input.password);
      logger.info({ email: input.email }, "auth.login");
      return result;
    }),

  me: authenticatedProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),
});
