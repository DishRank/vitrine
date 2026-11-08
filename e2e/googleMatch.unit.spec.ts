import { expect, test } from '@playwright/test';
import { distanceMeters, isSamePlace, nameSimilarity } from '../src/lib/googleMatch';

/**
 * Contrôle de correspondance Google (src/lib/googleMatch.ts) : la note d'un
 * autre lieu ne doit jamais être collée sur une fiche. Fonctions pures, sans
 * navigateur ni serveur.
 */
const lyon = { latitude: 45.764, longitude: 4.8357 };
const at = (dLatMeters: number) => ({ latitude: lyon.latitude + dLatMeters / 111_320, longitude: lyon.longitude });

test('distance', () => {
  expect(Math.round(distanceMeters(45.764, 4.8357, 45.764 + 100 / 111_320, 4.8357))).toBe(100);
});

test('noms : mots distinctifs, accents et articles ignorés', () => {
  expect(nameSimilarity('Daniel & Denise Saint-Jean', 'Daniel et Denise Saint Jean - Bouchon Lyonnais')).toBeCloseTo(0.8);
  expect(nameSimilarity('Paul', 'Paul Bocuse')).toBeCloseTo(2 / 3);
  expect(nameSimilarity('Le Café du Jura', 'Cafe du Jura')).toBe(1);
  expect(nameSimilarity('Resto Maestro E2E', 'Brasserie Georges')).toBe(0);
});

test('l’établissement de la base DEV (adresse fictive) ne reçoit pas la note d’un voisin', () => {
  // Cas réel : « Resto Maestro E2E, 1 rue du Test, Lyon » recevait 4,1 / 195 avis.
  expect(isSamePlace({ name: 'Resto Maestro E2E', ...lyon }, { name: 'Le Comptoir du Vin', ...at(120) })).toBe(false);
});

test('même lieu : accepté', () => {
  expect(
    isSamePlace(
      { name: 'Daniel & Denise Saint-Jean - Bouchon Lyonnais', ...lyon },
      { name: 'Daniel et Denise Saint-Jean', ...at(30) }
    )
  ).toBe(true);
});

test('même nom, mais loin : refusé (chaîne, homonyme)', () => {
  expect(isSamePlace({ name: 'Burger King', ...lyon }, { name: 'Burger King', ...at(2_000) })).toBe(false);
});

test('nom proche à 300 m : refusé ; nom identique à 300 m : accepté', () => {
  expect(isSamePlace({ name: 'Chez Paul Bocuse', ...lyon }, { name: 'Bistrot Paul', ...at(300) })).toBe(false);
  expect(isSamePlace({ name: 'Les Fils à Maman', ...lyon }, { name: 'Les Fils à Maman', ...at(300) })).toBe(true);
});

test('sans position : nom presque identique exigé', () => {
  expect(isSamePlace({ name: 'Nokyo' }, { name: 'Nokyo', ...lyon })).toBe(true);
  expect(isSamePlace({ name: 'Nokyo' }, { name: 'Sushi Shop', ...lyon })).toBe(false);
  expect(isSamePlace({ name: null }, { name: 'Nokyo' })).toBe(false);
});