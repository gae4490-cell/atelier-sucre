-- Stockage des photos
--  * vitrines     : public  — logos, couvertures et galerie ({atelier_id}/...)
--  * inspirations : privé   — photos envoyées par les clients ({atelier_id}/{demande_id}/...)
-- Les formats et la taille sont aussi contrôlés par Supabase côté serveur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('vitrines', 'vitrines', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('inspirations', 'inspirations', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- vitrines : seuls les membres de l'atelier gèrent les fichiers de leur dossier.
-- (La lecture publique passe par l'URL publique du bucket, sans listing.)
create policy vitrines_lecture_membres on storage.objects for select to authenticated
  using (bucket_id = 'vitrines' and public.est_membre(public.atelier_du_chemin(name)));
create policy vitrines_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'vitrines' and public.est_membre(public.atelier_du_chemin(name)));
create policy vitrines_modif on storage.objects for update to authenticated
  using (bucket_id = 'vitrines' and public.est_membre(public.atelier_du_chemin(name)))
  with check (bucket_id = 'vitrines' and public.est_membre(public.atelier_du_chemin(name)));
create policy vitrines_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'vitrines' and public.est_membre(public.atelier_du_chemin(name)));

-- inspirations : lecture (URL signée) réservée aux membres de l'atelier concerné.
-- Aucun envoi direct : les fichiers sont déposés par le serveur après validation.
create policy inspirations_lecture on storage.objects for select to authenticated
  using (bucket_id = 'inspirations' and public.est_membre(public.atelier_du_chemin(name)));
