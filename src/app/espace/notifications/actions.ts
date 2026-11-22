"use server";

import { revalidatePath } from "next/cache";
import { exigerAtelier } from "@/lib/atelier";
import { UUID_RE } from "@/lib/navigation";

export async function marquerLu(id: string | "toutes") {
  const { supabase, atelier } = await exigerAtelier();
  let req = supabase.from("notifications").update({ lue_le: new Date().toISOString() }).eq("atelier_id", atelier.id).is("lue_le", null);
  if (id !== "toutes") {
    if (!UUID_RE.test(id)) return;
    req = req.eq("id", id);
  }
  await req;
  revalidatePath("/espace", "layout");
}
