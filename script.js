// --- DOM elements ---
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");
const remixBtn = document.getElementById("remix-btn");
const remixTheme = document.getElementById("remix-theme");
const remixOutput = document.getElementById("remix-output");
const savedRecipesContainer = document.getElementById("saved-recipes-container");
const savedRecipesList = document.getElementById("saved-recipes-list");

// Hold the currently displayed recipe JSON so other functions can use it
let currentRecipe = null;

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// This function displays the recipe on the page
function renderRecipe(recipe) {
  // Save the recipe object so the remix and save buttons can access it
  currentRecipe = recipe;

  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <div class="recipe-actions">
      <button id="save-recipe-btn" class="main-btn">Save Recipe</button>
    </div>
  `;

  // Attach the save button handler after rendering
  const saveBtn = document.getElementById("save-recipe-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveCurrentRecipe);
}

// ---------------- Saved recipes (localStorage) ----------------
const STORAGE_KEY = "savedRecipes";

function getSavedRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setSavedRecipes(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderSavedList() {
  const list = getSavedRecipes();
  if (!list || list.length === 0) {
    savedRecipesContainer.style.display = "none";
    savedRecipesList.innerHTML = "";
    return;
  }

  savedRecipesContainer.style.display = "block";
  savedRecipesList.innerHTML = "";
  list.forEach((name) => {
    const li = document.createElement("li");
    li.className = "saved-item";

    const nameBtn = document.createElement("button");
    nameBtn.textContent = name;
    nameBtn.className = "link-btn";
    nameBtn.addEventListener("click", () => loadSavedRecipeByName(name));

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "delete-btn";
    delBtn.addEventListener("click", () => deleteSavedRecipe(name));

    li.appendChild(nameBtn);
    li.appendChild(delBtn);
    savedRecipesList.appendChild(li);
  });
}

function saveCurrentRecipe() {
  if (!currentRecipe || !currentRecipe.strMeal) return;
  const list = getSavedRecipes();
  if (!list.includes(currentRecipe.strMeal)) {
    list.push(currentRecipe.strMeal);
    setSavedRecipes(list);
    renderSavedList();
  }
}

function deleteSavedRecipe(name) {
  const list = getSavedRecipes().filter((n) => n !== name);
  setSavedRecipes(list);
  renderSavedList();
}

async function loadSavedRecipeByName(name) {
  recipeDisplay.innerHTML = "<p>Loading saved recipe...</p>";
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.meals && data.meals.length > 0) {
      renderRecipe(data.meals[0]);
      remixOutput.innerHTML = ""; // clear any previous remix
    } else {
      recipeDisplay.innerHTML = `<p>Couldn't find recipe: ${name}</p>`;
    }
  } catch (e) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load that saved recipe.</p>";
  }
}

// ---------------- Remix via OpenAI ----------------
async function remixRecipeWithAI(recipe, theme) {
  // Prepare a short instruction for the model and include the recipe JSON
  const systemPrompt = `You are a friendly, creative chef assistant. Produce a short (3-6 sentences) remix of the given recipe that is fun, creative, and totally doable in a home kitchen. Mention clearly any changed ingredients or cooking steps and keep the tone upbeat and helpful.`;

  const userPrompt = `Here is a recipe JSON object: ${JSON.stringify(recipe)}\n\nRemix theme: ${theme}\n\nReturn a short, clearly formatted remix that: 1) describes the final dish in one sentence, 2) lists any changed or swapped ingredients, and 3) summarizes any changed cooking steps. Keep it friendly and concise.`;

  // Show a friendly loading message while waiting
  remixOutput.innerHTML = "<p>Stirring up a tasty remix — one sec… 🍳</p>";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    const aiText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || null;
    if (!aiText) throw new Error("No response from AI");

    // Display the AI's remix
    remixOutput.innerHTML = `<pre class="remix-result">${escapeHtml(aiText)}</pre>`;
  } catch (err) {
    console.error(err);
    remixOutput.innerHTML = `<p>Whoops — I couldn't get a remix right now. Try again in a moment.</p>`;
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Wire the Remix button to use the current recipe and chosen theme
if (remixBtn) {
  remixBtn.addEventListener("click", () => {
    if (!currentRecipe) {
      remixOutput.innerHTML = "<p>Load a recipe first to remix it!</p>";
      return;
    }
    remixRecipeWithAI(currentRecipe, remixTheme.value);
  });
}

// Load saved list on start
document.addEventListener("DOMContentLoaded", () => {
  renderSavedList();
});

// This function gets a random recipe from the API and shows it
async function fetchAndDisplayRandomRecipe() {
  // Clear any previous remix output when loading a new random recipe
  if (typeof remixOutput !== 'undefined' && remixOutput) remixOutput.innerHTML = "";

  recipeDisplay.innerHTML = "<p>Loading...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php'); // Replace with the actual API URL
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response

    renderRecipe(recipe); // Display the recipe
    
  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
  }
}

randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);

// When the page loads, show a random recipe right away
document.addEventListener("DOMContentLoaded", fetchAndDisplayRandomRecipe);
