import { SUPABASE_URL, SUPABASE_ANON_KEY, SNAP_USERNAME, STORAGE_BUCKET } from "./config.js";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [];
let categories = [];
let selectedCategory = "Tous";
let searchTerm = "";

const $ = (s) => document.querySelector(s);

const esc = (v="") =>
String(v).replace(/[&<>"']/g, c => ({
'&':'&',
'<':'<',
'>':'>',
'"':'"',
"'":'''
}[c]));

const imageUrl = (path) =>
path
? (path.startsWith("http")
? path
: db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl)
: "";

function productSizes(product) {
return (product.product_sizes || [])
.filter(s => s.enabled)
.sort((a,b) =>
["S","M","L","XL","XXL"].indexOf(a.size) -
["S","M","L","XL","XXL"].indexOf(b.size)
);
}

function matches(p) {
const hay = [
p.name,
p.description,
p.categories?.name
].join(" ").toLowerCase();

return (
(selectedCategory === "Tous" ||
p.categories?.name === selectedCategory) &&
hay.includes(searchTerm)
);
}

/* =========================
CARTE PRODUIT
========================= */

function card(p) {

const sizes = productSizes(p);

const available =
sizes.filter(s => s.quantity > 0).length;

return ` <article class="product-card" data-id="${p.id}"> <div class="product-image">

```
    ${
      p.image_path
        ? `<img
            src="${esc(imageUrl(p.image_path))}"
            alt="${esc(p.name)}"
            loading="lazy">`
        : ""
    }

    ${
      p.is_new
        ? `<span class="tag">Nouveau</span>`
        : ""
    }

  </div>

  <div class="product-info">

    <p class="product-name">
      ${esc(p.name)}
    </p>

    <div class="product-price">
      ${Number(p.price).toLocaleString("fr-FR")} 🎾
    </div>

    <div class="product-meta">
      ${
        available
          ? `${available} taille${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}`
          : "Rupture de stock"
      }
    </div>

  </div>
</article>
```

`;
}

/* =========================
GRILLE
========================= */

function renderGrid(id, list) {

const el = $(id);

el.innerHTML =
list.length
? list.map(card).join("")
: "";

el.querySelectorAll(".product-card")
.forEach(c =>
c.addEventListener(
"click",
() => openProduct(c.dataset.id)
)
);
}

function render() {

const filtered =
products.filter(matches);

renderGrid("#productGrid", filtered);

$("#emptyState")
.classList
.toggle("hidden", filtered.length > 0);

renderGrid(
"#newGrid",
products.filter(p => p.is_new)
);

renderGrid(
"#featuredGrid",
products.filter(p => p.is_featured)
);
}

/* =========================
CATEGORIES
========================= */

function renderCategories() {

const names = [
"Tous",
...categories.map(c => c.name)
];

$("#categoryFilters").innerHTML =
names.map(n => `       <button
        class="filter-btn ${n === selectedCategory ? "active" : ""}"
        data-cat="${esc(n)}">
        ${esc(n)}       </button>
    `).join("");

$("#categoryFilters")
.querySelectorAll("button")
.forEach(b =>
b.addEventListener("click", () => {

```
    selectedCategory =
      b.dataset.cat;

    renderCategories();
    render();
  })
);
```

$("#categoryCards").innerHTML =
categories.map(c => `       <a
        class="category-card"
        href="#products"
        data-cat-card="${esc(c.name)}">
        ${esc(c.name)}       </a>
    `).join("");

$("#categoryCards")
.querySelectorAll("[data-cat-card]")
.forEach(b =>
b.addEventListener("click", () => {

```
    selectedCategory =
      b.dataset.catCard;

    renderCategories();
    render();
  })
);
```

}

/* =========================
CHARGEMENT SUPABASE
========================= */

async function load() {

const [
cats,
prods,
images
] = await Promise.all([

```
db
  .from("categories")
  .select("*")
  .eq("active", true)
  .order("sort_order"),

db
  .from("products")
  .select("*, categories(name), product_sizes(*)")
  .eq("active", true)
  .order("created_at", {
    ascending:false
  }),

db
  .from("product_images")
  .select("*")
  .order("sort_order")
```

]);

if (
cats.error ||
prods.error ||
images.error
) {

```
console.error(
  cats.error ||
  prods.error ||
  images.error
);

$("#productGrid").innerHTML = `
  <div class="loading-state">
    Configurez Supabase dans
    <code>js/config.js</code>.
  </div>
`;

return;
```

}

categories =
cats.data || [];

const imageRows =
images.data || [];

products =
(prods.data || []).map(product => ({

```
  ...product,

  gallery:
    imageRows
      .filter(img =>
        img.product_id === product.id
      )
      .sort((a,b) =>
        Number(a.sort_order || 0) -
        Number(b.sort_order || 0)
      )

}));
```

renderCategories();
render();

document
.querySelector(".loading-state")
?.remove();
}

/* =========================
GALERIE PRODUIT
========================= */

function openProduct(id) {

const p =
products.find(x => x.id === id);

if (!p) return;

/*
On prend l'image principale du produit
puis les images supplémentaires.
*/

const gallery = [];

if (p.image_path) {

```
gallery.push({
  image_path:p.image_path
});
```

}

for (const image of (p.gallery || [])) {

```
/*
  Évite d'afficher deux fois
  la même image.
*/

if (
  image.image_path &&
  !gallery.some(
    x => x.image_path === image.image_path
  )
) {

  gallery.push(image);
}
```

}

const firstImage =
gallery.length
? imageUrl(gallery[0].image_path)
: "";

$("#dialogContent").innerHTML = `

```
<div class="dialog-product">


  <!-- GALERIE -->

  <div class="product-gallery">

    <div class="gallery-main">

      ${
        firstImage
          ? `
            <img
              id="galleryMainImage"
              src="${esc(firstImage)}"
              alt="${esc(p.name)}">
          `
          : `
            <div class="gallery-empty">
              Pas d'image
            </div>
          `
      }

    </div>


    ${
      gallery.length > 1
        ? `
          <div class="gallery-thumbs">

            ${gallery.map((image,index) => `

              <button
                type="button"
                class="gallery-thumb ${index === 0 ? "active" : ""}"
                data-gallery-index="${index}">

                <img
                  src="${esc(imageUrl(image.image_path))}"
                  alt="${esc(p.name)}">

              </button>

            `).join("")}

          </div>
        `
        : ""
    }

  </div>


  <!-- INFORMATIONS -->

  <div class="dialog-copy">

    ${
      p.is_new
        ? `<p class="eyebrow">NOUVEAU</p>`
        : ""
    }

    <h2>
      ${esc(p.name)}
    </h2>

    <div class="dialog-price">
      ${Number(p.price).toLocaleString("fr-FR")} 🎾
    </div>

    <p class="dialog-desc">
      ${esc(p.description || "")}
    </p>


    <div class="sizes">

      ${
        productSizes(p)
          .map(s => `
            <div class="size-row">

              <strong>
                ${esc(s.size)}
              </strong>

              <span
                class="${s.quantity > 0 ? "available" : "soldout"}">

                ${
                  s.quantity > 0
                    ? `${s.quantity} disponible${s.quantity > 1 ? "s" : ""}`
                    : "Rupture"
                }

              </span>

            </div>
          `)
          .join("")
      }

    </div>


    <div class="order-note">

      Pour commander :
      contacte-moi directement sur Snapchat —
      ${esc(SNAP_USERNAME)}

    </div>

  </div>

</div>
```

`;

/*
Gestion des miniatures
*/

const mainImage =
$("#galleryMainImage");

document
.querySelectorAll(".gallery-thumb")
.forEach(button => {

```
  button.addEventListener("click", () => {

    const index =
      Number(
        button.dataset.galleryIndex
      );

    if (
      gallery[index] &&
      mainImage
    ) {

      mainImage.src =
        imageUrl(
          gallery[index].image_path
        );

      document
        .querySelectorAll(".gallery-thumb")
        .forEach(b =>
          b.classList.remove("active")
        );

      button.classList.add("active");
    }

  });

});
```

$("#productDialog").showModal();
}

/* =========================
FERMETURE
========================= */

$("#dialogClose")
.addEventListener(
"click",
() => $("#productDialog").close()
);

/* =========================
RECHERCHE
========================= */

$("#searchInput")
.addEventListener("input", e => {

```
searchTerm =
  e.target.value
    .trim()
    .toLowerCase();

render();
```

});

$("#searchTrigger")
.addEventListener("click", () => {

```
$("#searchInput").focus();

location.hash = "products";
```

});

/* =========================
MENU MOBILE
========================= */

document
.querySelector(".menu-toggle")
.addEventListener("click", e => {

```
const nav =
  document.querySelector(".main-nav");

nav.classList.toggle("open");

e.currentTarget.setAttribute(
  "aria-expanded",
  nav.classList.contains("open")
);
```

});

document
.querySelectorAll(".main-nav a")
.forEach(a =>
a.addEventListener(
"click",
() =>
document
.querySelector(".main-nav")
.classList.remove("open")
)
);

document
.querySelector(".snap-handle")
.textContent =
SNAP_USERNAME;

/* =========================
REALTIME
========================= */

db.channel("shop-live")

.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"products"
},
load
)

.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"product_sizes"
},
load
)

.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"categories"
},
load
)

.on(
"postgres_changes",
{
event:"*",
schema:"public",
table:"product_images"
},
load
)

.subscribe();

load();
