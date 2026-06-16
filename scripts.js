const INTERVAL_DURATION_MS = 25;
const BOARD_WIDTH = getElementPropertyAsFloat("board", 'width');
const BOARD_HEIGHT = getElementPropertyAsFloat("board", 'height');
const BOARD_HYPOTENUSE = Math.sqrt((BOARD_WIDTH**2) * 2);
const GOAL_DEPTH = getElementPropertyAsFloat('goal1', 'height');
const GOAL_BREADTH = getElementPropertyAsFloat('goal1', 'width');
const PLAYABLE_AREA_WIDTH = BOARD_WIDTH - (GOAL_DEPTH * 2);
const BALL_RADIUS = getElementPropertyAsFloat('ball', 'width') / 2;
const BALL_RADIUS_45_DEGREE_COMPONENT = Math.sqrt((BALL_RADIUS * BALL_RADIUS) / 2);
const BALL_RADIUS_SQUARE_HYPOTENUSE = Math.hypot(BALL_RADIUS, BALL_RADIUS);
const NEAR_GOAL_DISTANCE = (BALL_RADIUS * 2) + BALL_RADIUS_45_DEGREE_COMPONENT;
const MIN_BALL_SPEED = 10;
const MAX_BALL_SPEED = 100;
const DIRECTIONS = {
	RIGHT: "right",
	LEFT: "left"
};
const LOCAL_STORAGE_PATH = 'localstorage://intercept-predictor-model';

class Point {
	constructor(x, y){
		this.x = x;
		this.y = y;
	}
}

class Line {
	constructor(point1, point2){
		this.point1 = point1;
		this.point2 = point2;
	}
	
	isIntersectedByPoint(testPoint, radius = 0){
		const _self = this;
		
		var minX = Math.min(_self.point1.x, _self.point2.x);
		var maxX = Math.max(_self.point1.x, _self.point2.x);
		
		var minY = Math.min(_self.point1.y, _self.point2.y);
		var maxY = Math.max(_self.point1.y, _self.point2.y);
		
		if(testPoint.x + radius >= minX && testPoint.x - radius <= maxX &&
			testPoint.y + radius >= minY && testPoint.y - radius <= maxY &&
			radius > _self.getPerpendicularDistance(testPoint)){
			return true;
		}
		return false;
	}
	
	getPerpendicularDistance(testPoint) {
		const _self = this;
		const { x: x1, y: y1 } = _self.point1;
		const { x: x2, y: y2 } = _self.point2;

		var numerator = Math.abs((x2 - x1) * (y1 - testPoint.y) - (x1 - testPoint.x) * (y2 - y1));
		var denominator = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

		return numerator / denominator;
	}
}

class Corner {
	
	horizontalLine = null;
	diagonalLine = null;
	verticalLine = null;
	
	constructor(horizontalLine, diagonalLine, verticalLine){
		const _self = this;
		_self.horizontalLine = horizontalLine;
		_self.diagonalLine = diagonalLine;
		_self.verticalLine = verticalLine;
	}
	
}

class Rectangle {
	constructor(topLeftPoint, bottomRightPoint){
		this.topLeftPoint = topLeftPoint;
		this.bottomRightPoint = bottomRightPoint;
	}
	
	isIntersectedByPoint(point, radius = 0){
		const _self = this;
		if(point.x + radius >= _self.topLeftPoint.x &&
			point.x - radius <= _self.bottomRightPoint.x &&
			point.y + radius >= _self.topLeftPoint.y &&
			point.y - radius <= _self.bottomRightPoint.y){
			return true;
		}
		return false;
	}
}

class Board {
	
	player1 = null;
	player2 = null;
	player3 = null;
	player4 = null;
	ball = null;
	isStarted = false;
	gameLoop = null;
	isGoalLineCrossed = null;
	
	constructor(){
		const _self = this;
		_self.ball = new Ball();
	}
	
	async initGame(){
		const _self = this;
		
		// ============================================
		// Player Creation
		// ============================================
		document.querySelectorAll(".switch-toggle input:checked").forEach(el => {
			
			var elementId = el.id;
			var selection_playerNumber = elementId.split("_");
			var selection = selection_playerNumber[0];
			var playerNumber = selection_playerNumber[1];
			
			var isHuman = selection === 'p';
			var isAi = selection === 'ai';
			
			if(playerNumber === '1'){
				
				_self.player1 = new Player(1, 25, isHuman, isAi);
				document.getElementById("bumper" + playerNumber).getElementsByClassName("bumperLabel")[0].textContent = _self.player1.score;
				
			}else if(playerNumber === '2'){
			
				_self.player2 = new Player(2, 25, isHuman, isAi);
				document.getElementById("bumper" + playerNumber).getElementsByClassName("bumperLabel")[0].textContent = _self.player2.score;
				
			}else if(playerNumber === '3'){
				
				_self.player3 = new Player(3, 25, isHuman, isAi);
				document.getElementById("bumper" + playerNumber).getElementsByClassName("bumperLabel")[0].textContent = _self.player3.score;
				
			}else if(playerNumber === '4'){
			
				_self.player4 = new Player(4, 25, isHuman, isAi);
				document.getElementById("bumper" + playerNumber).getElementsByClassName("bumperLabel")[0].textContent = _self.player4.score;
				
			}
			
			document.querySelector('#bumper' + playerNumber + ' .playerLabel').innerHTML = elementId.toUpperCase();
			
		});
		
		_self.ball.resetBall();
		
		await _self.startGame();
	}
	
	async startGame(){
		const _self = this;
		
		_self.gameLoop = setInterval(async function(){
			
			await _self.player1.iterateSlide();
			await _self.player2.iterateSlide();
			await _self.player3.iterateSlide();
			await _self.player4.iterateSlide();
			
			//for each iteration, update the ball state based on position, angle and speed
			_self.ball.updateBallState();
			
			_self.recalculateIntercepts();
			
			//then redraw the ball based on the new ball state
			_self.ball.drawBall();
			
		}, INTERVAL_DURATION_MS);
		
		_self.isStarted = true;
	}
	
	stopGame(){
		const _self = this;
		clearInterval(_self.gameLoop);
		_self.isStarted = false;
	}
	
	recalculateIntercepts(){
		const _self = this;
		
		if(_self.player1.shouldRecalculateIntercept){
			_self.player1.drawNextIntercept();
			_self.player1.shouldRecalculateIntercept = false;
		}
		
		if(_self.player2.shouldRecalculateIntercept){
			_self.player2.drawNextIntercept();
			_self.player2.shouldRecalculateIntercept = false;
		}
		
		if(_self.player3.shouldRecalculateIntercept){
			_self.player3.drawNextIntercept();
			_self.player3.shouldRecalculateIntercept = false;
		}
		
		if(_self.player4.shouldRecalculateIntercept){
			_self.player4.drawNextIntercept();
			_self.player4.shouldRecalculateIntercept = false;
		}
		
	}
	
}

class BallState {
	
	speed = 0;
	angle = 0;
	//position of the center of the ball
	position = null;
	/*spin = {
		clockwise: true,
		speed: 10
	};*/
	
	constructor(speed, angle, ball_x = 0, ball_y = 0){
		const _self = this;
		_self.speed = speed;
		_self.angle = angle;
		_self.position = new Point(ball_x, ball_y);
	}
}

class Ball {
	
	#ballElement = null;
	ballState = null;
	
	constructor(){
		const _self = this;
		_self.ballState = new BallState();
	}
	
	#getBallElement(){
		const _self = this;
		if(_self.#ballElement == null){
			_self.#ballElement = document.getElementById("ball");
		}
		return _self.#ballElement;
	}
	
	increaseSpeed(increment = 5){
		const _self = this;
		_self.ballState.speed += increment;
	}
	
	resetBall(){
		const _self = this;
		
		//initialize new ball
		_self.ballState.speed = MIN_BALL_SPEED;
		
		_self.ballState.angle = getRandomAngle();
		
		var randomX = (BOARD_WIDTH / 2) - (BOARD_WIDTH / 8) + getRandomNumber(0, BOARD_WIDTH/4);
		var randomY = (BOARD_HEIGHT / 2) - (BOARD_HEIGHT / 8) + getRandomNumber(0, BOARD_HEIGHT/4);
		_self.ballState.position = new Point(randomX, randomY);
		
		BOARD.player1.drawNextIntercept();
		BOARD.player2.drawNextIntercept();
		BOARD.player3.drawNextIntercept();
		BOARD.player4.drawNextIntercept();
		
	}
	
	updateBallState(){
		const _self = this;
		
		var newBallState = new BallState(_self.ballState.speed, _self.ballState.angle, _self.ballState.position.x, _self.ballState.position.y);
		
		//to prevent clipping through edges at higher speeds, divide the distance to move into steps that are smaller than the collision radius and check for collisions at each step before finalizing the new ball position
		var numberOfLoops = parseInt(_self.ballState.speed / (BALL_RADIUS - 1)) + 1;
		for(var x=0; x<numberOfLoops; x++){
			
			var stepSpeed = _self.ballState.speed / numberOfLoops;
			
			//calculate new position before checking for boundary intersections
			var newPosition = getNewPositionFromAngleAndSpeed(newBallState.position, _self.ballState.angle, stepSpeed);
			
			newBallState.position = newPosition;
			
			//recalculate new position based on boundary intersections
			
			//check for goal line crossing
			if(BOARD.isGoalLineCrossed == null){
				if(newBallState.position.y < 0 + GOAL_DEPTH - BALL_RADIUS){
					BOARD.isGoalLineCrossed = 1;
				}else if(newBallState.position.x < 0 + GOAL_DEPTH - BALL_RADIUS){
					BOARD.isGoalLineCrossed = 2;
				}else if(newBallState.position.x > BOARD_WIDTH - GOAL_DEPTH + BALL_RADIUS){
					BOARD.isGoalLineCrossed = 3;
				}else if(newBallState.position.y > BOARD_HEIGHT - GOAL_DEPTH + BALL_RADIUS){
					BOARD.isGoalLineCrossed = 4;
				}
			}
			
			//check for score
			if(newBallState.position.y < 0 - BALL_RADIUS){
				BOARD.player1.processScore();
				return;
			}else if(newBallState.position.x < 0 - BALL_RADIUS){
				BOARD.player2.processScore();
				return;
			}else if(newBallState.position.x > BOARD_WIDTH + BALL_RADIUS){
				BOARD.player3.processScore();
				return;
			}else if(newBallState.position.y > BOARD_HEIGHT + BALL_RADIUS){
				BOARD.player4.processScore();
				return;
			}
			
			//Corners
			adjustForCornerSquareCollision_IsIntersected(newBallState, 1);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForCornerSquareCollision_IsIntersected(newBallState, 2);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForCornerSquareCollision_IsIntersected(newBallState, 3);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForCornerSquareCollision_IsIntersected(newBallState, 4);
			setRecalculateIfNearGoal(newBallState.position);
			
			//Bumpers
			adjustForBumperCollision_IsIntersected(newBallState, 1);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForBumperCollision_IsIntersected(newBallState, 2);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForBumperCollision_IsIntersected(newBallState, 3);
			setRecalculateIfNearGoal(newBallState.position);
			
			adjustForBumperCollision_IsIntersected(newBallState, 4);
			setRecalculateIfNearGoal(newBallState.position);
			
			//update ball state with new values
			_self.ballState = newBallState;
		}
	}
	
	drawBall(){
		const _self = this;
		
		var ballElement = _self.#getBallElement();
		ballElement.style.left = (_self.ballState.position.x - BALL_RADIUS) + "px";
		ballElement.style.top = (_self.ballState.position.y - BALL_RADIUS) + "px";
		//ballElement.style.transform = newSpin?
		
		var statsElement = document.getElementById("ballStats");
		statsElement.textContent = "x:" + parseInt(_self.ballState.position.x) + " y:" + parseInt(_self.ballState.position.y) + " θ:" + _self.ballState.angle + "°";
	}
	
}

class Player {
	
	playerNumber = 0;
	isHuman = false;
	isAI = false;
	score = 0;
	slideSpeed = 0;
	movingDirection = null;
	intercept_predictor = null;
	ai_prediction = null;
	shouldRecalculateIntercept = false;
	nextInterceptPosition = null;
	
	constructor(playerNumber, speed = MIN_BALL_SPEED, isHuman = false, isAI = false){
		
		const _self = this;
		
		_self.playerNumber = playerNumber;
		_self.slideSpeed = speed;
		_self.isHuman = isHuman;
		_self.isAI = isAI;
		
		// Initialize model for AI players
		if (_self.isAI) {
			_self.intercept_predictor = INTERCEPT_PREDICTOR;
		}
		
		if(isHuman){
			
			document.addEventListener('keydown', function(event) {
				if (event.repeat) { return; }
				
				if(event.keyCode == 37) {
					_self.startSlide(DIRECTIONS.LEFT);
				} else if(event.keyCode == 39) {
					_self.startSlide(DIRECTIONS.RIGHT);
				}
			});
			
			document.addEventListener('keyup', function(event) {
				if (event.repeat) { return; }
				
				switch (event.keyCode){
					case 37:
					case 39:
						_self.stopSlide();
						break;
					default:
						return;
				}
			});
			
		}
		
	}
	
	startSlide(direction){
		const _self = this;
		_self.movingDirection = direction;
	}
	
	getBumperMoveTowardTarget(bumper_x, target_x){
		//stay
		var move = 1;
		if(target_x + BALL_RADIUS < bumper_x){
			//left
			move = 0;
		}else if(target_x - BALL_RADIUS > bumper_x){
			//right
			move = 2;
		}
		
		return move;
	}
	
	getMoveFromAI(ball_x, ball_y, ball_velocity_x, ball_velocity_y){
		const _self = this;
		
		var predicted_intercept_xy = null;
		
		//if prediction already exists for the current velocity, use it instead of getting a new prediction
		if(_self.ai_prediction && _self.ai_prediction[0] === ball_velocity_x && _self.ai_prediction[1] === ball_velocity_y){
			
			predicted_intercept_xy = _self.ai_prediction[2];
			
		}else{
			
			//Normalization Logic
			const max_bounce_number = 40;
			
			const ball_xy_normalized = normalizeBallPosition(new Point(ball_x, ball_y));
			const ball_velocity_xy_normalized = normalizeBallVelocity(new Point(ball_velocity_x, ball_velocity_y));
			
			var state = [
				ball_xy_normalized.x,
				ball_xy_normalized.y,
				ball_velocity_xy_normalized.x,
				ball_velocity_xy_normalized.y
			];
			
			var bounce_number = 0;
			
			//step through each subsequent collision state until a state position is on the goalline
			while(!isGoallineBounce(state) && bounce_number < max_bounce_number){
				state = _self.intercept_predictor.predictNextState(state);
				bounce_number++;
			}
			
			if(bounce_number == max_bounce_number){
				//default to center when rally is too long to predict at the current bounce
				predicted_intercept_xy = new Point(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
			}else{
				predicted_intercept_xy = denormalizeBallPosition(new Point(state[0], state[1]));
			}
			//END Normalization Logic
			
			_self.ai_prediction = [ball_velocity_x, ball_velocity_y, predicted_intercept_xy];
			drawPredicted(predicted_intercept_xy, _self.playerNumber);
		}
		
		return predicted_intercept_xy.x;
	}
	
	async iterateSlide (){
		var _self = this;
		
		if(!_self.isHuman){
			
			const bumper_x_canonical = getBumperXCanonical(_self.playerNumber);
			const ball_xy_canonical = getBallPositionCanonical(BOARD.ball.ballState.position, _self.playerNumber);
			
			var target_x = null;
			
			if(_self.isAI){
				
				const ball_velocity_xy_canonical = getBallVelocityCanonical(BOARD.ball.ballState, _self.playerNumber);
				
				//neural network
				//target is a predicted intercept x position
				target_x = _self.getMoveFromAI(ball_xy_canonical.x, ball_xy_canonical.y, ball_velocity_xy_canonical.x, ball_velocity_xy_canonical.y);
				
			}else if(!_self.isHuman){
				
				//hardcoded CPU
				//target is the current ball x position
				target_x = ball_xy_canonical.x;
				
			}
			
			const move = _self.getBumperMoveTowardTarget(bumper_x_canonical, target_x);
			
			//move: 0=left, 1=stay, 2=right
			if(move == 0){
				_self.startSlide(DIRECTIONS.LEFT);
			}else if(move == 2){
				_self.startSlide(DIRECTIONS.RIGHT);
			}else{
				_self.stopSlide();
			}
		}
		
		const nearCornerOffset = getElementPropertyAsFloat('cornerSquare3', 'width');
		const farCornerOffset = nearCornerOffset + getElementPropertyAsFloat('goal4', 'width') - getElementPropertyAsFloat('bumper4', 'width');
		
		var bumperElement = document.getElementById("bumper" + _self.playerNumber);
		var bumperStyles = window.getComputedStyle(bumperElement,null);
		
		if(_self.movingDirection == DIRECTIONS.LEFT){
			
			if(_self.playerNumber == 4){
				//left
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("left"));
				var newPosition = currentPosition - _self.slideSpeed;
				if(newPosition <= nearCornerOffset){
					newPosition = nearCornerOffset;
				}
				bumperElement.style.left = newPosition + "px";
			}else if(_self.playerNumber == 1){
				//right
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("left"));
				var newPosition = currentPosition + _self.slideSpeed;
				if(newPosition >= farCornerOffset){
					newPosition = farCornerOffset;
				}
				bumperElement.style.left = newPosition + "px";
			}else if(_self.playerNumber == 2){
				//up
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("top"));
				var newPosition = currentPosition - _self.slideSpeed;
				if(newPosition <= nearCornerOffset){
					newPosition = nearCornerOffset;
				}
				bumperElement.style.top = newPosition + "px";
			}else if(_self.playerNumber == 3){
				//down
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("top"));
				var newPosition = currentPosition + _self.slideSpeed;
				if(newPosition >= farCornerOffset){
					newPosition = farCornerOffset;
				}
				bumperElement.style.top = newPosition + "px";
			}
			
		}else if(_self.movingDirection == DIRECTIONS.RIGHT){
			
			if(_self.playerNumber == 4){
				//right
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("left"));
				var newPosition = currentPosition + _self.slideSpeed;
				if(newPosition >= farCornerOffset){
					newPosition = farCornerOffset;
				}
				bumperElement.style.left = newPosition + "px";
			}else if(_self.playerNumber == 1){
				//left
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("left"));
				var newPosition = currentPosition - _self.slideSpeed;
				if(newPosition <= nearCornerOffset){
					newPosition = nearCornerOffset;
				}
				bumperElement.style.left = newPosition + "px";
			}else if(_self.playerNumber == 2){
				//down
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("top"));
				var newPosition = currentPosition + _self.slideSpeed;
				if(newPosition >= farCornerOffset){
					newPosition = farCornerOffset;
				}
				bumperElement.style.top = newPosition + "px";
			}else if(_self.playerNumber == 3){
				//up
				var currentPosition = parseFloat(bumperStyles.getPropertyValue("top"));
				var newPosition = currentPosition - _self.slideSpeed;
				if(newPosition <= nearCornerOffset){
					newPosition = nearCornerOffset;
				}
				bumperElement.style.top = newPosition + "px";
			}
			
		}
		
	}
	
	stopSlide(){
		var _self = this;
		_self.movingDirection = null;
	}
	
	processScore(){
		var _self = this;
		
		var bumperLabelElement = document.getElementById("bumper" + _self.playerNumber).getElementsByClassName("bumperLabel")[0];
		
		var goalElement = document.getElementById("goal" + _self.playerNumber);
		goalElement.classList.add("goalHighlight");
		setTimeout(function(){
			goalElement.classList.remove("goalHighlight");
		}, 300);
		
		_self.score++;
		bumperLabelElement.textContent = _self.score;
		
		const resetTime = getUnixSeconds();
		if(_self.playerNumber != BOARD.isGoalLineCrossed){
			//verify the ball goes out of bounds shortly after crossing the goal line
			console.log(BOARD.isGoalLineCrossed, _self.playerNumber);
		}
		BOARD.isGoalLineCrossed = null;
		
		BOARD.ball.resetBall();
	}
	
	drawNextIntercept(){
		const _self = this;
		
		var nextInterceptPosition = calculateBallIntercept(_self.playerNumber, BOARD.ball.ballState);
		
		//may fail to calculate the intercept on very long rallies
		if(nextInterceptPosition !== undefined){
			const predictBallElement = document.getElementById("calculateBall" + _self.playerNumber);
			predictBallElement.style.left = (nextInterceptPosition.x - BALL_RADIUS) + "px";
			predictBallElement.style.top = (nextInterceptPosition.y - BALL_RADIUS) + "px";
			
			_self.nextInterceptPosition = nextInterceptPosition;
		}
	}
	
}

class InterceptPredictor {
	
	#model = null;
	
	#createModel(hiddenLayerCount, layerUnitCount, learningRate) {
		const model = tf.sequential();
		
		model.add(tf.layers.dense({
			units: layerUnitCount,
			activation: 'relu',
			inputShape: [4] // ball_x_normalized, ball_y_normalized, ball_velocity_x_normalized, ball_velocity_y_normalized
		}));
		
		for(var x=0; x<hiddenLayerCount-1;x++){
			model.add(tf.layers.dense({
				units: layerUnitCount,
				activation: 'relu'
			}));
		}
		
		model.add(tf.layers.dense({
			units: 4, // ball_x_normalized', ball_y_normalized', ball_velocity_x_normalized', ball_velocity_y_normalized'
			activation: 'linear'
		}));
		
		this.#compileModel(model, learningRate);
		
		return model;
	}
	
	#compileModel(model, learningRate = 0.0003){
		
		model.compile({
			optimizer: tf.train.adam(learningRate),
			loss: 'meanSquaredError'
		});
		
	}
	
	async trainModel(hiddenLayerCount, layerUnitCount, learningRate, iterationCount){
		
		this.#model = this.#createModel(hiddenLayerCount, layerUnitCount, learningRate, iterationCount);
		
		let batchSize = 256;
		
		const validation = generateInputsAndLabels(5000);
		const validationXs = tf.tensor2d(validation[0]);
		const validationYs = tf.tensor2d(validation[1]);
		
		for (let iteration = 0; iteration < iterationCount; iteration++) {
			
			// Generate random valid game states
			const inputs_labels = generateInputsAndLabels(batchSize);
			
			const inputs = inputs_labels[0];
			const labels = inputs_labels[1];
			
			const xs = tf.tensor2d(inputs);
			const ys = tf.tensor2d(labels);
			const result = await this.#model.fit(xs, ys, { epochs: 1, verbose: 0 });
			xs.dispose();
			ys.dispose();
			
			if (iteration % 50 === 0){
				var training_loss = result.history.loss[0];
				var validation_loss = this.evaluateModel(validationXs, validationYs);
				console.log(`Iteration ${iteration}: train=${training_loss.toFixed(6)} val=${validation_loss.toFixed(6)}`);
				extendTracesForTrainingLossGraph(iteration, training_loss, validation_loss);
			}
		}
		
		//automatically save result in local storage for persistence
		await this.saveModelToLocalStorage();
		const models = await tf.io.listModels();
		if(models[LOCAL_STORAGE_PATH]){
			const storage_timestamp = models[LOCAL_STORAGE_PATH].dateSaved;
			updateStylesWithModelAdded(storage_timestamp);
		}
		
	}
	
	setModel(model){
		this.#compileModel(model);
		this.#model = model;
	}
	
	async loadModel(path){
		const model = await tf.loadLayersModel(path);
		this.setModel(model);
	}
	
	async importModel(jsonFile, weightsFile){
		const model = await tf.loadLayersModel(
			tf.io.browserFiles([jsonFile, weightsFile])
		);
		this.setModel(model);
		await this.saveModelToLocalStorage();
	}
	
	async saveModelToLocalStorage(){
		await this.#model.save(LOCAL_STORAGE_PATH);
	}
	
	async downloadModel(path){
		this.#model.save(path);
	}
	
	evaluateModel(validationXs, validationYs){
		const evaluation_tensor = this.#model.evaluate(validationXs, validationYs);
		const validation_loss = evaluation_tensor.dataSync()[0];
		evaluation_tensor.dispose();
		return validation_loss;
	}
	
	async deleteModelFromLocalStorage(){
		await tf.io.removeModel(LOCAL_STORAGE_PATH);
	}
	
	predictNextState(input_state) {
		
		const predicted_state = tf.tidy(() => {
			const stateTensor = tf.tensor2d(input_state, [1, 4]);
			const prediction = this.#model.predict(stateTensor);
			return prediction.arraySync()[0];
		});
		
		return predicted_state;
	}
	
	predictBatchOfStates(inputs){
		const predictions = tf.tidy(() => {
			const stateTensor = tf.tensor2d(inputs, [inputs.length, 4]);
			const prediction = this.#model.predict(stateTensor);
			return prediction.arraySync();
		});
		
		return predictions;
	}
}

const INTERCEPT_PREDICTOR = new InterceptPredictor();
(async () => {
	//initialize with previously trained model if it exists
	const models = await tf.io.listModels();
	if(models[LOCAL_STORAGE_PATH]){
		await INTERCEPT_PREDICTOR.loadModel(LOCAL_STORAGE_PATH);
		const storage_timestamp = models[LOCAL_STORAGE_PATH].dateSaved;
		updateStylesWithModelAdded(storage_timestamp);
	}else{
		//otherwise default to embedded model
		const model = await loadEmbeddedModel();
		await INTERCEPT_PREDICTOR.setModel(model);
		await INTERCEPT_PREDICTOR.saveModelToLocalStorage();
		const models_2 = await tf.io.listModels();
		if(models_2[LOCAL_STORAGE_PATH]){
			const storage_timestamp = models_2[LOCAL_STORAGE_PATH].dateSaved;
			updateStylesWithModelAdded(storage_timestamp);
		}
	}
})();

const BOARD = new Board();

function getRandomNumber(min, max){
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getElementProperty(elementId, prop){
	var element = document.getElementById(elementId);
	var elementStyles = window.getComputedStyle(element);
	return elementStyles.getPropertyValue(prop);
}

function getElementPropertyAsFloat(elementId, prop){
	return parseFloat(getElementProperty(elementId, prop));
}

function degreesToRadians(angle){
	return angle * Math.PI/180;
}

function degSin(angle){
	return Math.sin(degreesToRadians(angle));
}

function degCos(angle){
	return Math.cos(degreesToRadians(angle));
}

function getRandomAngle(){
	return (getRandomNumber(0, 35) + 5) + (45 * getRandomNumber(0,7));
}

function graphPosition(x, y){
	const newDiv = document.createElement('div');
	newDiv.style.position = 'absolute'; 
	newDiv.style.top = y+'px';
	newDiv.style.left = x+'px';
	newDiv.style.width = '4px';
	newDiv.style.height = '4px';
	newDiv.style.backgroundColor = 'red';
	newDiv.style.zIndex = '301';
	document.body.appendChild(newDiv);
}

function getRandomPosition(){
	const x = (Math.random() * (PLAYABLE_AREA_WIDTH - (2 * BALL_RADIUS))) + GOAL_DEPTH + BALL_RADIUS;
	const y = (Math.random() * (PLAYABLE_AREA_WIDTH - (2 * BALL_RADIUS))) + GOAL_DEPTH + BALL_RADIUS;
	//if the position is inside one of the corners, generate a new position
	if(y <= -x + (3*GOAL_DEPTH) + BALL_RADIUS_SQUARE_HYPOTENUSE ||
		y >= x + BOARD_HEIGHT - (3*GOAL_DEPTH) - BALL_RADIUS_SQUARE_HYPOTENUSE ||
		y <= x + (3*GOAL_DEPTH) - BOARD_WIDTH + BALL_RADIUS_SQUARE_HYPOTENUSE ||
		y >= -x + (BOARD_WIDTH - (3*GOAL_DEPTH)) + BOARD_HEIGHT - BALL_RADIUS_SQUARE_HYPOTENUSE){
		return getRandomPosition();
	}
	return new Point(x, y);
}

//Rotating to player 4 frame of reference
function getBallPositionCanonical(ballPosition, playerNumber){
	var canonicalPosition = new Point(0, 0);
	
	if(playerNumber === 4){
		//0-1000, 0-1000
		canonicalPosition = new Point(ballPosition.x, ballPosition.y);
	}else if(playerNumber === 1){
		//1000-0, 1000-0
		canonicalPosition = new Point(BOARD_WIDTH - ballPosition.x, BOARD_HEIGHT - ballPosition.y);
	}else if(playerNumber === 2){
		//rotating counterclockwise
		canonicalPosition = new Point(ballPosition.y, BOARD_WIDTH - ballPosition.x);
	}else if(playerNumber === 3){
		//rotating clockwise
		canonicalPosition = new Point(BOARD_HEIGHT - ballPosition.y, ballPosition.x);
	}
	
	return canonicalPosition;
}
//Rotating to player 4 frame of reference
function getBallVelocityCanonical(ballState, playerNumber){
	var nextBallPosition = getNewPositionFromAngleAndSpeed(ballState.position, ballState.angle, ballState.speed);
	
	//player 4
	var ball_velocity_x = nextBallPosition.x - ballState.position.x;
	var ball_velocity_y = nextBallPosition.y - ballState.position.y;
	var canonicalVelocity = new Point(ball_velocity_x, ball_velocity_y);
	
	if(playerNumber === 1){
		//inverted
		var ballVelocityXRotated = (-1) * ball_velocity_x;
		var ballVelocityYRotated = (-1) * ball_velocity_y;
		canonicalVelocity = new Point(ballVelocityXRotated, ballVelocityYRotated);
	}else if(playerNumber === 2){
		//rotating counterclockwise
		var ballVelocityXRotated = ball_velocity_y;
		var ballVelocityYRotated = (-1) * ball_velocity_x;
		canonicalVelocity = new Point(ballVelocityXRotated, ballVelocityYRotated);
	}else if(playerNumber === 3){
		//rotating clockwise
		var ballVelocityXRotated = (-1) * ball_velocity_y;
		var ballVelocityYRotated = ball_velocity_x;
		canonicalVelocity = new Point(ballVelocityXRotated, ballVelocityYRotated);
	}
	
	return canonicalVelocity;
}
//Rotating to player 4 frame of reference
function getBumperXCanonical(playerNumber){
	
	var bumperLateralPosition = 0;
	
	if(playerNumber === 1 || playerNumber === 4){
	
		//300-700
		bumperLateralPosition = getElementPropertyAsFloat("bumper" + playerNumber, 'left') + getElementPropertyAsFloat("bumper" + playerNumber, 'width') / 2;
		
		if(playerNumber === 1){
			//700-300
			bumperLateralPosition = BOARD_WIDTH - bumperLateralPosition;
		}
		
	}else if(playerNumber === 2 || playerNumber === 3){
		
		//300-700
		bumperLateralPosition = getElementPropertyAsFloat("bumper" +  playerNumber, 'top') + getElementPropertyAsFloat("bumper" +  playerNumber, 'height') / 2;
		
		if(playerNumber === 3){
			//700-300
			bumperLateralPosition = BOARD_WIDTH - bumperLateralPosition;
		}
		
	}
	
	return bumperLateralPosition;
}

function drawPredicted(canonical_intercept_xy, playerNumber){
	const local_intercept_xy = getBallPositionLocal(canonical_intercept_xy, playerNumber);
	
	const predictBallElement = document.getElementById("predictBall" + playerNumber);
	predictBallElement.style.left = (local_intercept_xy.x - BALL_RADIUS) + "px";
	predictBallElement.style.top = (local_intercept_xy.y - BALL_RADIUS) + "px";
}

function getBallPositionLocal(canonical_position_xy, playerNumber){
	var local_position = new Point(0, 0);
	
	if(playerNumber === 4){
		//0-1000, 0-1000
		local_position = new Point(canonical_position_xy.x, canonical_position_xy.y);
	}else if(playerNumber === 1){
		//1000-0, 1000-0
		local_position = new Point(BOARD_WIDTH - canonical_position_xy.x, BOARD_HEIGHT - canonical_position_xy.y);
	}else if(playerNumber === 3){
		//rotating counterclockwise
		local_position = new Point(canonical_position_xy.y, BOARD_WIDTH - canonical_position_xy.x);
	}else if(playerNumber === 2){
		//rotating clockwise
		local_position = new Point(BOARD_HEIGHT - canonical_position_xy.y, canonical_position_xy.x);
	}
	
	return local_position;
}

function isGoallineBounce(state){
	const ball_xy = denormalizeBallPosition(new Point(state[0],state[1]));
	const velocity_xy = denormalizeBallVelocity(new Point(state[2],state[3]));
	const goalline_y = BOARD_HEIGHT - GOAL_DEPTH;
	
	const distance_y = goalline_y - ball_xy.y;
	const inverted_velocity_x = velocity_xy.x * (-1);
	const inverted_velocity_y = velocity_xy.y * (-1);
	const distance_x = ((distance_y / inverted_velocity_y) * inverted_velocity_x);
	const intercept_x = ball_xy.x + distance_x;
	
	//if ball is close enough to the goalline for the current frame to possibly be a rebound
	//and if reversing the ball velocity produces an intersection with a valid location on the goalline
	//then the bounce was on the goalline
	if(inverted_velocity_y >= distance_y && intercept_x >= (2 * GOAL_DEPTH) + BALL_RADIUS && intercept_x <= BOARD_WIDTH - ((2 * GOAL_DEPTH) + BALL_RADIUS)){
		return true;
	}
	return false;
}

function normalizeAngle(angle){
	//double modulus for negative angles
	return ((angle % 360) + 360) % 360;
}

function normalizeBallVelocity(ball_velocity_xy){
	//normalize to -1,1 range
	const ball_velocity_x_normalized = ball_velocity_xy.x / MAX_BALL_SPEED;
	//inverting y-axis
	const ball_velocity_y_normalized = (-1) * ball_velocity_xy.y / MAX_BALL_SPEED;
	return new Point(ball_velocity_x_normalized, ball_velocity_y_normalized);
}

function normalize(absoluteValue, min, max){
	return (absoluteValue - min) / (max - min);
}

function normalizeBallPosition(ball_xy){
	//normalize to -0.5,0.5 range
	const ball_x_normalized = normalize(ball_xy.x, 0 + GOAL_DEPTH, BOARD_WIDTH - GOAL_DEPTH) - 0.5;
	//inverting y-axis
	const ball_y_normalized = (1 - normalize(ball_xy.y, 0 + GOAL_DEPTH, BOARD_HEIGHT - GOAL_DEPTH)) - 0.5;
	return new Point(ball_x_normalized, ball_y_normalized);
}

function denormalizeBallVelocity(ball_velocity_xy_normalized){
	const ball_velocity_x = ball_velocity_xy_normalized.x * MAX_BALL_SPEED;
	//inverting y-axis
	const ball_velocity_y = (-1) * ball_velocity_xy_normalized.y * MAX_BALL_SPEED;
	return new Point(ball_velocity_x, ball_velocity_y);
}

function denormalize(normalized_value, min, max){
	return (normalized_value * (max - min)) + min;
}

function denormalizeBallPosition(ball_xy_normalized){
	const ball_x = denormalize(ball_xy_normalized.x + 0.5, 0 + GOAL_DEPTH, BOARD_WIDTH - GOAL_DEPTH);
	//inverting y-axis
	const ball_y = denormalize(1 - (ball_xy_normalized.y + 0.5), 0 + GOAL_DEPTH, BOARD_HEIGHT - GOAL_DEPTH);
	return new Point(ball_x, ball_y);
}

function getDeltaXY(angle, speed){
	var changeX = 0;
	var changeY = 0;
	
	/* Angle diagram
		  0	
		 \|/
	270 --o-- 90
		 /|\
		 180
	*/
	
	//speed is the distance in pixels of each execution loop
	
	if(angle < 90){
		var adjustedAngle = angle;
		changeX = speed * degSin(adjustedAngle);
		changeY = speed * degCos(adjustedAngle) * (-1);
	}else if(angle < 180){
		var adjustedAngle = angle - 90;
		changeY = speed * degSin(adjustedAngle);
		changeX = speed * degCos(adjustedAngle);
	}else if(angle < 270){
		var adjustedAngle = angle - 180;
		changeX = speed * degSin(adjustedAngle) * (-1);
		changeY = speed * degCos(adjustedAngle);
	}else{
		var adjustedAngle = angle - 270;
		changeY = speed * degSin(adjustedAngle) * (-1);
		changeX = speed * degCos(adjustedAngle) * (-1);
	}
	
	return new Point(changeX, changeY);
}

function getAngleAndSpeed(deltaXY){
	const angle = (Math.atan2(deltaXY.x, -deltaXY.y) * (180 / Math.PI) + 360) % 360;
	const speed = Math.hypot(deltaXY.x, deltaXY.y);
	return [angle, speed];
}

function getNewPositionFromAngleAndSpeed(currentPosition, angle, speed){
	var deltaXY = getDeltaXY(angle, speed);
	return new Point(currentPosition.x + deltaXY.x, currentPosition.y + deltaXY.y);
}

function getUnixSeconds(){
	return Math.floor(Date.now() / 1000);
}

function calculateNextState(input_state_normalized){
	
	const ball_xy = denormalizeBallPosition(new Point(input_state_normalized[0], input_state_normalized[1]));
	const ball_velocity_xy = denormalizeBallVelocity(new Point(input_state_normalized[2], input_state_normalized[3]));
	const angle_speed = getAngleAndSpeed(ball_velocity_xy);
	
	const starting_ball_state = new BallState(angle_speed[1], angle_speed[0], ball_xy.x, ball_xy.y);
	const new_ball_state = calculateNextCollision(starting_ball_state);
	if(new_ball_state === undefined || new_ball_state.position === undefined){
		//calculation failed
		return;
	}
	
	const ball_xy_normalized = normalizeBallPosition(new_ball_state.position);
	const ball_velocity_xy_normalized = normalizeBallVelocity(getDeltaXY(new_ball_state.angle, new_ball_state.speed));
	
	const output_state_normalized = [
		ball_xy_normalized.x,
		ball_xy_normalized.y,
		ball_velocity_xy_normalized.x,
		ball_velocity_xy_normalized.y
	];
	
	return output_state_normalized;
}

function calculateBallIntercept(playerNumber, startingBallState){
	
	var newBallState = new BallState(startingBallState.speed, startingBallState.angle, startingBallState.position.x, startingBallState.position.y);
	
	//looping over the predicted sequence of collisions to find the next goalline intercept for the current player
	const max_prediction_attempts = 700;
	for(var x=0; x<max_prediction_attempts; x++){
		
		newBallState = calculateNextCollision(newBallState);
		
		if(newBallState === undefined || newBallState.position === undefined){
			//calculation failed
			return;
		}
		
		if(playerNumber === 1 && isNearGoal1(newBallState.position)){
			return newBallState.position;
		}
		if(playerNumber === 2 && isNearGoal2(newBallState.position)){
			return newBallState.position;
		}
		if(playerNumber === 3 && isNearGoal3(newBallState.position)){
			return newBallState.position;
		}
		if(playerNumber === 4 && isNearGoal4(newBallState.position)){
			return newBallState.position;
		}
	}
	
}

function calculateNextCollision(startingBallState){
	
	var newBallState = new BallState(startingBallState.speed, startingBallState.angle, startingBallState.position.x, startingBallState.position.y);
	
	//to prevent clipping through edges at higher speeds, divide the distance to move into steps that are smaller than the collision radius and check for collisions at each step before finalizing the new ball position
	var numberOfLoops = parseInt(BOARD_HYPOTENUSE / (BALL_RADIUS - 1)) + 1;
	for(var x=0; x<numberOfLoops; x++){
		
		var stepSpeed = BOARD_HYPOTENUSE / numberOfLoops;
		
		//calculate new position before checking for boundary intersections
		var newPosition = getNewPositionFromAngleAndSpeed(newBallState.position, newBallState.angle, stepSpeed);
		
		newBallState.position = newPosition;
		
		//recalculate new position based on boundary intersections
		
		//Corner 1
		if(adjustForCornerSquareCollision_IsIntersected(newBallState, 1)){
			return newBallState;
		}
		
		//Corner 2
		if(adjustForCornerSquareCollision_IsIntersected(newBallState, 2)){
			return newBallState;
		}
		
		//Corner 3
		if(adjustForCornerSquareCollision_IsIntersected(newBallState, 3)){
			return newBallState;
		}
		
		//Corner 4
		if(adjustForCornerSquareCollision_IsIntersected(newBallState, 4)){
			return newBallState;
		}
		
		//Assume goal lines will behave like walls
		//Goal lines
		if(adjustForGoallineCollision_IsIntersected(newBallState, 1)){
			return newBallState;
		}
		if(adjustForGoallineCollision_IsIntersected(newBallState, 2)){
			return newBallState;
		}
		if(adjustForGoallineCollision_IsIntersected(newBallState, 3)){
			return newBallState;
		}
		if(adjustForGoallineCollision_IsIntersected(newBallState, 4)){
			return newBallState;
		}
		
	}
}

function adjustForCornerSquareCollision_IsIntersected(newBallState, cornerSquareNumber){
	
	var isIntersected = false;
	
	const cornerSquareId = "cornerSquare" + cornerSquareNumber;
	
	var cornerSquareWidth = getElementPropertyAsFloat(cornerSquareId, 'width');
	var cornerSquareHeight = cornerSquareWidth;
	
	var cornerSquareLeft = getElementPropertyAsFloat(cornerSquareId, 'left');
	var cornerSquareTop = getElementPropertyAsFloat(cornerSquareId, 'top');
	
	/*
	Corner points map
	      .4     4.
	C1    |       |    C2
	      .3     3.
	.___.`         `.___.
	1   2           2   1
	
	1   2           2   1
	.---.           .---.
	     `.3     3.`
	C3    |       |    C4
	      .4     4.
	*/
	
	var cornerSquarePoint1 = null;
	var cornerSquarePoint2 = null;
	var cornerSquarePoint3 = null;
	var cornerSquarePoint4 = null;
	
	if(cornerSquareNumber === 1){
		cornerSquarePoint1 = new Point(cornerSquareLeft, cornerSquareTop + cornerSquareHeight);
		cornerSquarePoint2 = new Point(cornerSquareLeft + (cornerSquareWidth / 2), cornerSquareTop + cornerSquareHeight);
		cornerSquarePoint3 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop + (cornerSquareHeight / 2));
		cornerSquarePoint4 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop);
	}
	if(cornerSquareNumber === 2){
		cornerSquarePoint1 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop + cornerSquareHeight);
		cornerSquarePoint2 = new Point(cornerSquareLeft + (cornerSquareWidth / 2), cornerSquareTop + cornerSquareHeight);
		cornerSquarePoint3 = new Point(cornerSquareLeft, cornerSquareTop + (cornerSquareHeight / 2));
		cornerSquarePoint4 = new Point(cornerSquareLeft, cornerSquareTop);
	}
	if(cornerSquareNumber === 3){
		cornerSquarePoint1 = new Point(cornerSquareLeft, cornerSquareTop);
		cornerSquarePoint2 = new Point(cornerSquareLeft + (cornerSquareWidth / 2), cornerSquareTop);
		cornerSquarePoint3 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop + (cornerSquareHeight / 2));
		cornerSquarePoint4 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop + cornerSquareHeight);
	}
	if(cornerSquareNumber === 4){
		cornerSquarePoint1 = new Point(cornerSquareLeft + cornerSquareWidth, cornerSquareTop);
		cornerSquarePoint2 = new Point(cornerSquareLeft + (cornerSquareWidth / 2), cornerSquareTop);
		cornerSquarePoint3 = new Point(cornerSquareLeft, cornerSquareTop + (cornerSquareHeight / 2));
		cornerSquarePoint4 = new Point(cornerSquareLeft, cornerSquareTop + cornerSquareHeight);
	}
	
	const horizontalLine = new Line(cornerSquarePoint1, cornerSquarePoint2);
	const diagonalLine = new Line(cornerSquarePoint2, cornerSquarePoint3);
	const verticalLine = new Line(cornerSquarePoint3, cornerSquarePoint4);
	const corner = new Corner(horizontalLine, diagonalLine, verticalLine);
	
	if(corner.horizontalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(540 - newBallState.angle);
		if(cornerSquareNumber === 1 || cornerSquareNumber === 2){
			newBallState.position.y = corner.horizontalLine.point1.y + BALL_RADIUS;
		}else{
			newBallState.position.y = corner.horizontalLine.point1.y - BALL_RADIUS;
		}
		isIntersected = true;
	}else if(corner.diagonalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		var reflectAngle = (cornerSquareNumber === 1 || cornerSquareNumber === 4) ? 450 : 630;
		newBallState.angle = normalizeAngle(reflectAngle - newBallState.angle);
		
		//to prevent glitching on the corners, bump the ball back from the collision edge by a distance equal to the perpendicular radius
		if(cornerSquareNumber === 1){
			newBallState.position.x += BALL_RADIUS_45_DEGREE_COMPONENT;
			newBallState.position.y += BALL_RADIUS_45_DEGREE_COMPONENT;
		}else if(cornerSquareNumber === 2){
			newBallState.position.x -= BALL_RADIUS_45_DEGREE_COMPONENT;
			newBallState.position.y += BALL_RADIUS_45_DEGREE_COMPONENT;
		}else if(cornerSquareNumber === 3){
			newBallState.position.x += BALL_RADIUS_45_DEGREE_COMPONENT;
			newBallState.position.y -= BALL_RADIUS_45_DEGREE_COMPONENT;
		}else if(cornerSquareNumber === 4){
			newBallState.position.x -= BALL_RADIUS_45_DEGREE_COMPONENT;
			newBallState.position.y -= BALL_RADIUS_45_DEGREE_COMPONENT;
		}
		isIntersected = true;
	}else if(corner.verticalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(360 - newBallState.angle);
		if(cornerSquareNumber === 1 || cornerSquareNumber === 3){
			newBallState.position.x = corner.verticalLine.point1.x + BALL_RADIUS;
		}else{
			newBallState.position.x = corner.verticalLine.point1.x - BALL_RADIUS;
		}
		isIntersected = true;
	}
	
	return isIntersected;
}

function adjustForBumperCollision_IsIntersected(newBallState, player){
	
	var isIntersected = false;
	
	var bumperId = 'bumper' + player;
	
	var bumperWidth = getElementPropertyAsFloat(bumperId, 'width');
	var bumperHeight = bumperWidth;
	
	var bumperLeft = getElementPropertyAsFloat(bumperId, 'left');
	var bumperTop = getElementPropertyAsFloat(bumperId, 'top');
	
	var bumperPoint1 = new Point(bumperLeft, bumperTop);
	var bumperPoint2 = new Point(bumperLeft, bumperTop + bumperHeight);
	var bumperPoint3 = new Point(bumperLeft + bumperWidth, bumperTop + bumperHeight);
	var bumperPoint4 = new Point(bumperLeft + bumperWidth, bumperTop);
	
	var bumperLine1 = new Line(bumperPoint1, bumperPoint2);
	var bumperLine2 = new Line(bumperPoint2, bumperPoint3);
	var bumperLine3 = new Line(bumperPoint3, bumperPoint4);
	var bumperLine4 = new Line(bumperPoint4, bumperPoint1);
	
	//prioritize the front bumper face to prevent inverted side deflections
	if(player === 1){
		if(adjustForBumperBottom_IsIntersected(newBallState, bumperLine2)){
			isIntersected = true;
		}else if(
			adjustForBumperLeft_IsIntersected(newBallState, bumperLine1) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3) ||
			adjustForBumperTop_IsIntersected(newBallState, bumperLine4)
		){
			isIntersected = true;
		}
	}
	if(player === 2){
		if(adjustForBumperLeft_IsIntersected(newBallState, bumperLine1)){
			isIntersected = true;
		}else if(
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3) ||
			adjustForBumperTop_IsIntersected(newBallState, bumperLine4)
		){
			isIntersected = true;
		}
	}
	if(player === 3){
		if(adjustForBumperRight_IsIntersected(newBallState, bumperLine3)){
			isIntersected = true;
		}else if(
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2) ||
			adjustForBumperLeft_IsIntersected(newBallState, bumperLine1) ||
			adjustForBumperTop_IsIntersected(newBallState, bumperLine4)
		){
			isIntersected = true;
		}
	}
	if(player === 4){
		if(adjustForBumperTop_IsIntersected(newBallState, bumperLine4)){
			isIntersected = true;
		}else if(
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2) ||
			adjustForBumperLeft_IsIntersected(newBallState, bumperLine1) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3)
		){
			isIntersected = true;
		}
	}
	
	return isIntersected;
}

function adjustForGoallineCollision_IsIntersected(newBallState, playerNumber){
	const goalId = "goal"+playerNumber;
	var goalLeft = getElementPropertyAsFloat(goalId, 'left');
	var goalTop = getElementPropertyAsFloat(goalId, 'top');
	
	var goalWidth = getElementPropertyAsFloat(goalId, 'width');
	var goalHeight = getElementPropertyAsFloat(goalId, 'height');
	
	var goalPoint1 = new Point(goalLeft, goalTop + goalHeight);
	var goalPoint2 = new Point(goalLeft + goalWidth, goalTop + goalHeight);
	var goalPoint3 = new Point(goalLeft + goalWidth, goalTop);
	var goalPoint4 = new Point(goalLeft, goalTop);
	
	var lineBottom = new Line(goalPoint1, goalPoint2);
	var lineRight = new Line(goalPoint2, goalPoint3);
	var lineTop = new Line(goalPoint3, goalPoint4);
	var lineLeft = new Line(goalPoint4, goalPoint1);
	
	//player 1
	if(playerNumber === 1 && adjustForBumperBottom_IsIntersected(newBallState, lineBottom)){
		return true;
	}
	//player 2
	if(playerNumber === 2 && adjustForBumperRight_IsIntersected(newBallState, lineRight)){
		return true;
	}
	//player 3
	if(playerNumber === 3 && adjustForBumperLeft_IsIntersected(newBallState, lineLeft)){
		return true;
	}
	//player 4
	if(playerNumber === 4 && adjustForBumperTop_IsIntersected(newBallState, lineTop)){
		return true;
	}
	return false;
}

function adjustForBumperLeft_IsIntersected(newBallState, bumperLine1){
	if(bumperLine1.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(360 - newBallState.angle);
		newBallState.position.x = bumperLine1.point1.x - BALL_RADIUS;
		newBallState.speed += (MAX_BALL_SPEED - newBallState.speed) * 0.05;
		return true;
	}
	return false;
}

function adjustForBumperBottom_IsIntersected(newBallState, bumperLine2){
	if(bumperLine2.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(540 - newBallState.angle);
		newBallState.position.y = bumperLine2.point1.y + BALL_RADIUS;
		newBallState.speed += (MAX_BALL_SPEED - newBallState.speed) * 0.05;
		return true;
	}
	return false;
}

function adjustForBumperRight_IsIntersected(newBallState, bumperLine3){
	if(bumperLine3.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(360 - newBallState.angle);
		newBallState.position.x = bumperLine3.point1.x + BALL_RADIUS;
		newBallState.speed += (MAX_BALL_SPEED - newBallState.speed) * 0.05;
		return true;
	}
	return false;
}

function adjustForBumperTop_IsIntersected(newBallState, bumperLine4){
	if(bumperLine4.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(540 - newBallState.angle);
		newBallState.position.y = bumperLine4.point1.y - BALL_RADIUS;
		newBallState.speed += (MAX_BALL_SPEED - newBallState.speed) * 0.05;
		return true;
	}
	return false;
}

function setRecalculateIfNearGoal(ball_position_xy){
	//recalculate the intercept when deflection is near a goal line
	if(isNearGoal1(ball_position_xy) && !isInGoal1(ball_position_xy)){
		BOARD.player1.shouldRecalculateIntercept = true;
	}
	if(isNearGoal2(ball_position_xy) && !isInGoal2(ball_position_xy)){
		BOARD.player2.shouldRecalculateIntercept = true;
	}
	if(isNearGoal3(ball_position_xy) && !isInGoal3(ball_position_xy)){
		BOARD.player3.shouldRecalculateIntercept = true;
	}
	if(isNearGoal4(ball_position_xy) && !isInGoal4(ball_position_xy)){
		BOARD.player4.shouldRecalculateIntercept = true;
	}
}

function isNearGoal1(ball_position_xy){
	return ball_position_xy.y - NEAR_GOAL_DISTANCE < GOAL_DEPTH;
}
function isInGoal1(ball_position_xy){
	return ball_position_xy.y < GOAL_DEPTH;
}
function isNearGoal2(ball_position_xy){
	return ball_position_xy.x - NEAR_GOAL_DISTANCE < GOAL_DEPTH;
}
function isInGoal2(ball_position_xy){
	return ball_position_xy.x < GOAL_DEPTH;
}
function isNearGoal3(ball_position_xy){
	return ball_position_xy.x + NEAR_GOAL_DISTANCE > BOARD_WIDTH - GOAL_DEPTH;
}
function isInGoal3(ball_position_xy){
	return ball_position_xy.x > BOARD_WIDTH - GOAL_DEPTH;
}
function isNearGoal4(ball_position_xy){
	return ball_position_xy.y + NEAR_GOAL_DISTANCE > BOARD_HEIGHT - GOAL_DEPTH;
}
function isInGoal4(ball_position_xy){
	return ball_position_xy.y > BOARD_HEIGHT - GOAL_DEPTH;
}

function showIntercept(playerNumber){
	document.getElementById('calculateBall' + playerNumber).style.display = "inline-block";
	document.getElementById('predictBall' + playerNumber).style.display = "inline-block";
}

function generateInputsAndLabels(sample_size = 100){
	// Generate random valid game states
	const inputs = [];
	const labels = [];
	
	var iterationsCompleted = 0;
	while(iterationsCompleted < sample_size) {
		
		const ball_speed = (Math.random() * (MAX_BALL_SPEED - MIN_BALL_SPEED)) + MIN_BALL_SPEED;
		const ball_xy = getRandomPosition();
		
		//generate random absolute ball state
		const starting_ball_state = new BallState(ball_speed, getRandomAngle(), ball_xy.x, ball_xy.y);
		
		//calculate next collision
		const next_collision_ball_state = calculateNextCollision(starting_ball_state);
		
		//only train on data if the correct output could be calculated
		if(next_collision_ball_state !== undefined){
			
			//normalize inputs
			const starting_ball_xy_normalized = normalizeBallPosition(starting_ball_state.position);
			const starting_delta_xy = getDeltaXY(starting_ball_state.angle, starting_ball_state.speed);
			const starting_ball_velocity_xy_normalized = normalizeBallVelocity(starting_delta_xy);
			
			//normalize labels
			const next_collision_state_xy_normalized = normalizeBallPosition(next_collision_ball_state.position);
			const next_collision_state_delta_xy = getDeltaXY(next_collision_ball_state.angle, next_collision_ball_state.speed);
			const next_collision_state_velocity_xy_normalized = normalizeBallVelocity(next_collision_state_delta_xy);
			
			inputs.push([
				starting_ball_xy_normalized.x,
				starting_ball_xy_normalized.y,
				starting_ball_velocity_xy_normalized.x,
				starting_ball_velocity_xy_normalized.y
			]);
			
			labels.push([
				next_collision_state_xy_normalized.x,
				next_collision_state_xy_normalized.y,
				next_collision_state_velocity_xy_normalized.x,
				next_collision_state_velocity_xy_normalized.y
			]);
			
			iterationsCompleted++;
		}
		
	}
	
	return [inputs, labels];
}

function updateStylesWithModelAdded(lastModified){
	document.getElementById('assignPlayersPanel').classList.add('hasModel');
	document.getElementById('localStorageModelTime').innerHTML = new Date(lastModified).toLocaleString();
	
	document.getElementById('ai_1').disabled = false;
	document.getElementById('ai_2').disabled = false;
	document.getElementById('ai_3').disabled = false;
	document.getElementById('ai_4').disabled = false;
}

function updateStylesWithModelRemoved(){
	document.getElementById('assignPlayersPanel').classList.remove('hasModel');
	document.getElementById('localStorageModelTime').innerHTML = '';
	
	document.getElementById('ai_1').disabled = true;
	document.getElementById('ai_2').disabled = true;
	document.getElementById('ai_3').disabled = true;
	document.getElementById('ai_4').disabled = true;
}

// ============================================
// UI Event Handlers
// ============================================
function validateModelConfigurationFields(hiddenLayerCount, layerUnitCount, learningRate, iterationCount){
	var isValid = true;
	if(Number.isNaN(hiddenLayerCount) || hiddenLayerCount < 1){
		isValid = false;
	}
	if(Number.isNaN(layerUnitCount) || layerUnitCount < 8){
		isValid = false;
	}
	if(Number.isNaN(learningRate) || learningRate <= 0){
		isValid = false;
	}
	if(Number.isNaN(iterationCount) || iterationCount < 1){
		isValid = false;
	}
	return isValid;
}

document.getElementById('trainModelBtn').addEventListener('click', async () => {
	
	const hiddenLayerCount = document.getElementById('hiddenLayerCount').valueAsNumber;
	const layerUnitCount = parseInt(document.getElementById('layerUnitCount').value);
	const learningRate = document.getElementById('learningRate').valueAsNumber;
	const iterationCount = document.getElementById('iterationCount').valueAsNumber;
	
	if(!validateModelConfigurationFields(hiddenLayerCount, layerUnitCount, learningRate, iterationCount)){
		return;
	}
	
	document.getElementById('trainModelBtn').firstElementChild.style.display = "inline-block";
	document.getElementById('trainModelBtn').disabled = true;
	document.getElementById('exportModelBtn').disabled = true;
	document.getElementById('analyzeModelBtn').disabled = true;
	document.getElementById('trainModelMessage').innerHTML = 'Training...';
	document.getElementById('trainingGraphContainer').style.display = "inline-block";
	plotTrainingLossGraph();
	
	//force UI changes before starting model training
	await new Promise(requestAnimationFrame);
	
	await INTERCEPT_PREDICTOR.trainModel(hiddenLayerCount, layerUnitCount, learningRate, iterationCount);
	
	document.getElementById('trainModelBtn').firstElementChild.style.display = "none";
	document.getElementById('trainModelBtn').disabled = false;
	document.getElementById('exportModelBtn').disabled = false;
	document.getElementById('exportModelBtn').style.display = "inline-block";
	document.getElementById('analyzeModelBtn').disabled = false;
	document.getElementById('trainModelMessage').innerHTML = 'Model training is complete. Model will be used by AI players.';
});

document.getElementById('startGameBtn').addEventListener('click', async () => {
	document.getElementById('titleScreenContainer').style.display = "none";
	document.querySelectorAll(".predictBall").forEach(el => {
		el.style.display = "none"
	});
	
	await BOARD.initGame();
});

function checkImportFiles(){
	if(document.getElementById('upload-json').files.length > 0 && document.getElementById('upload-weights').files.length > 0){
		document.getElementById('importModelBtn').disabled = false;
	}else{
		document.getElementById('importModelBtn').disabled = true;
	}
}

document.getElementById('upload-json').addEventListener('change', function(){
	checkImportFiles();
});
document.getElementById('upload-weights').addEventListener('change', function(){
	checkImportFiles();
});

document.getElementById('importModelBtn').addEventListener('click', async () => {
	const jsonFile = document.getElementById('upload-json').files[0];
	const weightsFile = document.getElementById('upload-weights').files[0];
	if(jsonFile && weightsFile){
		await INTERCEPT_PREDICTOR.importModel(jsonFile, weightsFile);
		
		const models = await tf.io.listModels();
		if(models[LOCAL_STORAGE_PATH]){
			const storage_timestamp = models[LOCAL_STORAGE_PATH].dateSaved;
			updateStylesWithModelAdded(storage_timestamp);
		}
		
		document.getElementById('upload-json').value = '';
		document.getElementById('upload-weights').value = '';
		document.getElementById('upload-json').dispatchEvent(new Event('change', {
			bubbles: true
		}));
	}
});

document.getElementById('exportModelBtn').addEventListener('click', async () => {
	await INTERCEPT_PREDICTOR.downloadModel('downloads://intercept-predictor-model');
});

document.getElementById('deleteModelBtn').addEventListener('click', async () => {
	await INTERCEPT_PREDICTOR.deleteModelFromLocalStorage();
	updateStylesWithModelRemoved();
});

document.getElementById('modelExpandBtn').addEventListener('click', async () => {
	if(document.getElementById('modelExpandBtn').innerHTML === '-'){
		document.getElementById('modelFilesImportContainer').style.display = "none";
		document.getElementById('trainAnalyzeSection').style.display = "none";
		document.getElementById('modelExpandBtn').innerHTML = "+";
	}else{
		document.getElementById('modelFilesImportContainer').style.display = "inline-block";
		document.getElementById('trainAnalyzeSection').style.display = "inline-block";
		document.getElementById('modelExpandBtn').innerHTML = "-";
	}
});

document.addEventListener('keyup', async function(event) {
	if (event.repeat) { return; }
	
	switch (event.keyCode){
		case 32:
			//spacebar
			if(BOARD.isStarted){
				BOARD.stopGame();
			}else{
				await BOARD.startGame();
			}
		case 27:
			//escape
			if(BOARD.isStarted){
				BOARD.stopGame();
				document.getElementById('titleScreenContainer').style.display = "inline-block";
			}else if(BOARD.player1){
				//continue existing game
				document.getElementById('titleScreenContainer').style.display = "none";
				await BOARD.startGame();
			}
		default:
			return;
	}
});
