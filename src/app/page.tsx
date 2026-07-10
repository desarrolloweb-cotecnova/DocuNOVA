import { redirect } from "next/navigation";

/**
 * Raíz de la aplicación. Envía al panel; el proxy y el layout privado se
 * encargan de redirigir a /login o a la verificación MFA si corresponde.
 */
export default function Home() {
  redirect("/dashboard");
}
