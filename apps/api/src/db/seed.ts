import { db } from './index';
import { categories } from './schema';

const CATEGORIES = [
  { name: 'Panadería y cafetería', slug: 'panaderia-cafeteria', icon: '🥖', sortOrder: 1 },
  { name: 'Restaurantes', slug: 'restaurantes', icon: '🍽️', sortOrder: 2 },
  { name: 'Mercado y frutas', slug: 'mercado-frutas', icon: '🥬', sortOrder: 3 },
  { name: 'Droguería y salud', slug: 'drogueria-salud', icon: '💊', sortOrder: 4 },
  { name: 'Ferretería', slug: 'ferreteria', icon: '🔧', sortOrder: 5 },
  { name: 'Papelería', slug: 'papeleria', icon: '✏️', sortOrder: 6 },
  { name: 'Belleza y cuidado', slug: 'belleza-cuidado', icon: '💅', sortOrder: 7 },
  { name: 'Mascotas', slug: 'mascotas', icon: '🐾', sortOrder: 8 },
  { name: 'Tecnología', slug: 'tecnologia', icon: '💻', sortOrder: 9 },
  { name: 'Moda', slug: 'moda', icon: '👕', sortOrder: 10 },
  { name: 'Hogar', slug: 'hogar', icon: '🛋️', sortOrder: 11 },
  { name: 'Otros', slug: 'otros', icon: '🛍️', sortOrder: 12 },
];

async function main() {
  for (const category of CATEGORIES) {
    await db
      .insert(categories)
      .values(category)
      .onConflictDoNothing({ target: categories.slug });
  }
  console.log(`Categorías listas: ${CATEGORIES.length}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('No se pudieron sembrar las categorías', error);
  process.exit(1);
});
