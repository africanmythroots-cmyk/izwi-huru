-- Migration: 009_seed_initial_spaces.sql
-- Seeds default pan-African spaces so the platform has active communities from day one.

INSERT INTO spaces (slug, name, description, language_code, country_scope)
VALUES
  (
    'general',
    'Pan-African General',
    'Open discussion across all 54 African countries and the diaspora.',
    'en',
    NULL
  ),
  (
    'swahili',
    'Pan-Afrika Kiswahili',
    'Majadiliano huru ya nchi zote za Afrika kwa lugha ya Kiswahili.',
    'sw',
    NULL
  ),
  (
    'panafricain-fr',
    'Panafricain Français',
    'Discussions ouvertes pour toute l''Afrique francophone.',
    'fr',
    NULL
  )
ON CONFLICT (slug) DO NOTHING;
