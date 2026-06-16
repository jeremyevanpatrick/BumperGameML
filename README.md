# Bumper Game ML

A browser-based physics game with an integrated machine learning pipeline built on **TensorFlow.js**. Four bumpers compete to deflect a bouncing ball into their opponents' goals. What makes this project unique is that each player slot can be assigned to a **human**, a **CPU**, or a **trained AI** — and the AI model is trained, evaluated, and deployed entirely within the browser, with no server or build step required.

---

## How It Works

The game simulates a ball bouncing around a square arena with four bumpers — one on each side. When the ball collides with a bumper, it deflects based on the physics of the collision. The ML model's task is to **predict the ball's next position and velocity** (X, Y, VX, VY) after a bounce, so that an AI-controlled bumper can anticipate where the ball will go and position itself accordingly.

---

## Features

**Game**
- 4-player bumper arena with a single bouncing ball
- Each player independently assignable as Human, CPU, or AI
- Goals on each side — players score by deflecting the ball past opponents

**ML Pipeline — all in browser**
- Train a new neural network model from scratch using TensorFlow.js
- Live training loss graph displayed during the training run
- Export the trained model as `.json` + `.bin` files (TF.js SavedModel format)
- Re-import a previously exported model from the local file system
- Model persisted to `localStorage` between sessions
- Model status indicator shows whether a model is loaded

**Model Analysis**
A dedicated analysis panel visualizes model performance across all four predicted output variables (X, Y, VX, VY):

| Chart | Description |
|---|---|
| Predicted vs Actual | Scatter plot comparing model predictions to physics ground truth |
| Residual Histogram | Distribution of prediction errors |
| Residual vs Actual | Scatter plot of errors against actual values — reveals bias |
| Rollout Average Error at Bounce | How prediction error accumulates over successive bounces |

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| TensorFlow.js | 4.11.0 | In-browser neural network training and inference |
| Plotly.js | 2.35.3 | Model analysis charts and visualizations |
| Vanilla JavaScript | ES6+ | Game engine, ML pipeline, UI logic |
| HTML / CSS | — | Layout and styling |

No build tools, no frameworks, no server required — the entire project runs directly from the HTML file.

---

## Training a Model

1. Open the app and go to the **Assign Players** screen
2. In the **AI Model** panel, click **Train New Model**
3. The training loss graph updates live as the model trains on bounce simulation data
4. Once training completes, the model is saved to `localStorage`
5. Assign one or more players to **AI** and start the game

---

## Importing / Exporting a Model

- **Export:** Click the **Export** button in the model panel to download the model as a `.json` descriptor and `.bin` weights file
- **Import:** Use the file inputs to select a previously exported `.json` and `.bin`, then click **Import Files**

---

## Analyzing a Model

Click **Analyze Model** to open the analysis panel. Scatter plots and histograms for all four output variables (X, Y, VX, VY) give a detailed view of where the model performs well and where it falls short.

---

## License

This project is licensed under the MIT License.
