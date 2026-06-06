const INTERVAL_DURATION_MS = 25;
const BOARD_WIDTH = getElementPropertyAsFloat("board", 'width');
const BOARD_HEIGHT = getElementPropertyAsFloat("board", 'height');
const GOAL_DEPTH = getElementPropertyAsFloat('goal1', 'height');
const GOAL_BREADTH = getElementPropertyAsFloat('goal1', 'width');
const BALL_RADIUS = getElementPropertyAsFloat('ball', 'width') / 2;
const BALL_RADIUS_NORMALIZED = BALL_RADIUS / BOARD_WIDTH;
const MIN_BALL_SPEED = 10;
const MAX_BALL_SPEED = 100;
const DIRECTIONS = {
	RIGHT: "right",
	LEFT: "left"
};

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
		var _self = this;
		
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
		const { x: x1, y: y1 } = this.point1;
		const { x: x2, y: y2 } = this.point2;

		var numerator = Math.abs((x2 - x1) * (y1 - testPoint.y) - (x1 - testPoint.x) * (y2 - y1));
		var denominator = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

		return numerator / denominator;
	}
}

class Rectangle {
	constructor(topLeftPoint, bottomRightPoint){
		this.topLeftPoint = topLeftPoint;
		this.bottomRightPoint = bottomRightPoint;
	}
	
	isIntersectedByPoint(point, radius = 0){
		if(point.x + radius >= this.topLeftPoint.x &&
			point.x - radius <= this.bottomRightPoint.x &&
			point.y + radius >= this.topLeftPoint.y &&
			point.y - radius <= this.bottomRightPoint.y){
			return true;
		}
		return false;
	}
}

class InterceptPredictor {
	constructor(){
		this.model = this.#createModel();
	}
	
	#createModel() {
		const model = tf.sequential();
		
		model.add(tf.layers.dense({
			units: 32,
			activation: 'relu',
			inputShape: [4] // ball_x_normalized, ball_y_normalized, ball_velocity_x_normalized, ball_velocity_y_normalized
		}));
		model.add(tf.layers.dense({
			units: 32,
			activation: 'relu'
		}));
		model.add(tf.layers.dense({
			units: 1,
			activation: 'linear'
		}));
		
		model.compile({
			optimizer: tf.train.adam(0.001),
			loss: 'meanSquaredError'
		});
		
		return model;
	}
	
	async trainModel(){
		let epochs = 500;
		let batchSize = 256;
		
		for (let epoch = 0; epoch < epochs; epoch++) {
			
			// Generate random valid game states
			const inputs = [];
			const labels = [];
			
			const playableAreaWidth = BOARD_WIDTH - (GOAL_DEPTH * 2);
			
			for (let i = 0; i < batchSize; i++) {
				
				const ball_x_normalized = Math.random();
				const ball_x = (ball_x_normalized * playableAreaWidth) + GOAL_DEPTH;
				
				const ball_y_normalized = Math.random();
				const ball_y = (ball_y_normalized * playableAreaWidth) + GOAL_DEPTH;
				
				const ball_angle = getRandomAngle();
				//limiting max speed for training to 30 instead of MAX_BALL_SPEED
				const ball_speed = (Math.random() * (30 - MIN_BALL_SPEED)) + MIN_BALL_SPEED;
				const delta_xy = getDeltaXY(ball_angle, ball_speed);
				
				const ball_velocity_x_normalized = normalizeBallVelocity(delta_xy.x);
				const ball_velocity_y_normalized = normalizeBallVelocity(delta_xy.y);
				
				//should test always be moving toward goalline?
				
				const startingBallState = {
					speed: ball_speed,
					angle: ball_angle,
					position: new Point(ball_x, ball_y)
				};
				
				const actual_intercept_position = predictBallIntercept(4, startingBallState);
				
				//only train on data if the correct output was successfully calculated
				if(actual_intercept_position !== undefined){
					
					const actual_intercept_x_normalized = (actual_intercept_position.x - GOAL_DEPTH) / playableAreaWidth;
					
					inputs.push([
						ball_x_normalized,
						ball_y_normalized,
						ball_velocity_x_normalized,
						ball_velocity_y_normalized
					]);
					
					labels.push([actual_intercept_x_normalized]);
					
				}
				
			}
			
			const xs = tf.tensor2d(inputs);
			const ys = tf.tensor2d(labels);
			const result = await this.model.fit(xs, ys, { epochs: 1, verbose: 0 });
			xs.dispose();
			ys.dispose();
			
			if (epoch % 50 === 0) console.log(`Epoch ${epoch}: loss = ${result.history.loss[0].toFixed(6)}`);
		}
	}
	
	loadModel(model){
		this.model = model;
	}
	
	async saveModel(path){
		this.model.save(path);
	}
	
	predictX(state) {
		return tf.tidy(() => {
			const stateTensor = tf.tensor2d([state]);
			const prediction = this.model.predict(stateTensor);
			return prediction.argMax(-1).dataSync()[0];
		});
	}
}

const INTERCEPT_PREDICTOR = new InterceptPredictor();

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

function normalizeAngle(angle){
	//double modulus for negative angles
	return ((angle % 360) + 360) % 360;
}

function normalize(absoluteValue, min, max){
	return (Math.sign(absoluteValue) * (Math.abs(absoluteValue) - min)) / (max - min);
}

function normalizeBallVelocity(ballVelocity){
	return normalize(ballVelocity, MIN_BALL_SPEED, MAX_BALL_SPEED);
}

function normalizeBallPosition(ball_xy){
	const ball_x_normalized = normalize(ball_xy.x, 0 + GOAL_DEPTH, BOARD_WIDTH - GOAL_DEPTH);
	const ball_y_normalized = normalize(ball_xy.y, 0 + GOAL_DEPTH, BOARD_HEIGHT - GOAL_DEPTH);
	return new Point(ball_x_normalized, ball_y_normalized);
}

function normalizeBumperX(bumper_x){
	return normalize(bumper_x, 0 + GOAL_DEPTH, BOARD_WIDTH - GOAL_DEPTH);
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

function getNewPositionFromAngleAndSpeed(currentPosition, angle, speed){
	var deltaXY = getDeltaXY(angle, speed);
	return new Point(currentPosition.x + deltaXY.x, currentPosition.y + deltaXY.y);
}

function getUnixSeconds(){
	return Math.floor(Date.now() / 1000);
}

function predictBallIntercept(playerNumber, startingBallState){
	
	var currentPosition = new Point(startingBallState.position.x, startingBallState.position.y);
	
	const topBoundary = 0;
	const bottomBoundary = BOARD_HEIGHT;
	const leftBoundary = 0;
	const rightBoundary = BOARD_WIDTH;
	
	var newBallState = {
		speed: 91000000,
		angle: startingBallState.angle,
		position: currentPosition
	};
	
	//to prevent clipping through edges at higher speeds, divide the distance to move into steps that are smaller than the collision radius and check for collisions at each step before finalizing the new ball position
	var numberOfLoops = parseInt(newBallState.speed / (BALL_RADIUS - 1)) + 1;
	for(var x=0; x<numberOfLoops; x++){
		
		var stepSpeed = newBallState.speed / numberOfLoops;
		
		//calculate new position before checking for boundary intersections
		var newPosition = getNewPositionFromAngleAndSpeed(newBallState.position, newBallState.angle, stepSpeed);
		
		newBallState.position = newPosition;
		
		//check if the ball is breaking the plane of a goalline
		if(playerNumber === 1 && newBallState.position.y - BALL_RADIUS < (topBoundary + GOAL_DEPTH)){
			return newBallState.position;
		}
		if(playerNumber === 2 && newBallState.position.x - BALL_RADIUS < (leftBoundary + GOAL_DEPTH)){
			return newBallState.position;
		}
		if(playerNumber === 3 && newBallState.position.x + BALL_RADIUS > (rightBoundary - GOAL_DEPTH)){
			return newBallState.position;
		}
		if(playerNumber === 4 && newBallState.position.y + BALL_RADIUS > (bottomBoundary - GOAL_DEPTH)){
			return newBallState.position;
		}
		
		//recalculate new position based on boundary intersections
		var lines = {
			horizontalLine: null,
			diagonalLine: null,
			verticalLine: null
		};
		
		var cornerSquareWidth = getElementPropertyAsFloat('cornerSquare1', 'width');
		var cornerSquareHeight = cornerSquareWidth;
		
		//Square 1
		var cornerSquare1Left = getElementPropertyAsFloat('cornerSquare1', 'left');
		var cornerSquare1Top = getElementPropertyAsFloat('cornerSquare1', 'top');
		
		var cornerSquare1Point1 = new Point(cornerSquare1Left, cornerSquare1Top + cornerSquareHeight);
		var cornerSquare1Point2 = new Point(cornerSquare1Left + (cornerSquareWidth / 2), cornerSquare1Top + cornerSquareHeight);
		var cornerSquare1Point3 = new Point(cornerSquare1Left + cornerSquareWidth, cornerSquare1Top + (cornerSquareHeight / 2));
		var cornerSquare1Point4 = new Point(cornerSquare1Left + cornerSquareWidth, cornerSquare1Top);
		
		lines = {
			horizontalLine: new Line(cornerSquare1Point1, cornerSquare1Point2),
			diagonalLine: new Line(cornerSquare1Point2, cornerSquare1Point3),
			verticalLine: new Line(cornerSquare1Point3, cornerSquare1Point4)
		};
		adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 1);
		
		//Square 2
		var cornerSquare2Left = getElementPropertyAsFloat('cornerSquare2', 'left');
		var cornerSquare2Top = getElementPropertyAsFloat('cornerSquare2', 'top');
		
		var cornerSquare2Point1 = new Point(cornerSquare2Left, cornerSquare2Top);
		var cornerSquare2Point2 = new Point(cornerSquare2Left, cornerSquare2Top + (cornerSquareHeight / 2));
		var cornerSquare2Point3 = new Point(cornerSquare2Left + (cornerSquareWidth / 2), cornerSquare2Top + cornerSquareHeight);
		var cornerSquare2Point4 = new Point(cornerSquare2Left + cornerSquareWidth, cornerSquare2Top + cornerSquareHeight);
		
		lines = {
			horizontalLine: new Line(cornerSquare2Point3, cornerSquare2Point4),
			diagonalLine: new Line(cornerSquare2Point2, cornerSquare2Point3),
			verticalLine: new Line(cornerSquare2Point1, cornerSquare2Point2)
		};
		adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 2);
		
		//Square 3
		var cornerSquare3Left = getElementPropertyAsFloat('cornerSquare3', 'left');
		var cornerSquare3Top = getElementPropertyAsFloat('cornerSquare3', 'top');
		
		var cornerSquare3Point1 = new Point(cornerSquare3Left, cornerSquare3Top);
		var cornerSquare3Point2 = new Point(cornerSquare3Left + (cornerSquareWidth / 2), cornerSquare3Top);
		var cornerSquare3Point3 = new Point(cornerSquare3Left + cornerSquareWidth, cornerSquare3Top + (cornerSquareHeight / 2));
		var cornerSquare3Point4 = new Point(cornerSquare3Left + cornerSquareWidth, cornerSquare3Top + cornerSquareHeight);
		
		lines = {
			horizontalLine: new Line(cornerSquare3Point1, cornerSquare3Point2),
			diagonalLine: new Line(cornerSquare3Point2, cornerSquare3Point3),
			verticalLine: new Line(cornerSquare3Point3, cornerSquare3Point4)
		};
		adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 3);
		
		//Square 4
		var cornerSquare4Left = getElementPropertyAsFloat('cornerSquare4', 'left');
		var cornerSquare4Top = getElementPropertyAsFloat('cornerSquare4', 'top');
		
		var cornerSquare4Point1 = new Point(cornerSquare4Left, cornerSquare4Top + cornerSquareHeight);
		var cornerSquare4Point2 = new Point(cornerSquare4Left, cornerSquare4Top + (cornerSquareHeight / 2));
		var cornerSquare4Point3 = new Point(cornerSquare4Left + (cornerSquareWidth / 2), cornerSquare4Top);
		var cornerSquare4Point4 = new Point(cornerSquare4Left + cornerSquareWidth, cornerSquare4Top);
		
		lines = {
			horizontalLine: new Line(cornerSquare4Point3, cornerSquare4Point4),
			diagonalLine: new Line(cornerSquare4Point2, cornerSquare4Point3),
			verticalLine: new Line(cornerSquare4Point1, cornerSquare4Point2)
		};
		adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 4);
		
		//Assume other goal lines will behave like walls
		//Goal lines
		if(playerNumber !== 1){
			//Goal line 1
			var goal1Left = getElementPropertyAsFloat("goal1", 'left');
			var goal1Top = getElementPropertyAsFloat("goal1", 'top');
			
			var goal1Point1 = new Point(goal1Left, goal1Top + GOAL_DEPTH);
			var goal1Point2 = new Point(goal1Left + GOAL_BREADTH, goal1Top + GOAL_DEPTH);
			
			var goal1Line = new Line(goal1Point1, goal1Point2);
			
			adjustForBumperBottom_IsIntersected(newBallState, goal1Line);
		}
		
		if(playerNumber !== 2){
			//Goal line 2
			var goal2Left = getElementPropertyAsFloat("goal2", 'left');
			var goal2Top = getElementPropertyAsFloat("goal2", 'top');
			
			var goal2Point1 = new Point(goal2Left + GOAL_DEPTH, goal2Top);
			var goal2Point2 = new Point(goal2Left + GOAL_DEPTH, goal2Top + GOAL_BREADTH);
			
			var goal2Line = new Line(goal2Point1, goal2Point2);
			
			adjustForBumperRight_IsIntersected(newBallState, goal2Line);
		}
		
		if(playerNumber !== 3){
			//Goal line 3
			var goal3Left = getElementPropertyAsFloat("goal3", 'left');
			var goal3Top = getElementPropertyAsFloat("goal3", 'top');
			
			var goal3Point1 = new Point(goal3Left, goal3Top);
			var goal3Point2 = new Point(goal3Left, goal3Top + GOAL_BREADTH);
			
			var goal3Line = new Line(goal3Point1, goal3Point2);
			
			adjustForBumperLeft_IsIntersected(newBallState, goal3Line);
		}
		
		if(playerNumber !== 4){
			//Goal line 4
			var goal4Left = getElementPropertyAsFloat("goal4", 'left');
			var goal4Top = getElementPropertyAsFloat("goal4", 'top');
			
			var goal4Point1 = new Point(goal4Left, goal4Top);
			var goal4Point2 = new Point(goal4Left + GOAL_BREADTH, goal4Top);
			
			var goal4Line = new Line(goal4Point1, goal4Point2);
			
			adjustForBumperTop_IsIntersected(newBallState, goal4Line);
		}
		
	}
	
	//couldn't find intercept
	console.log(numberOfLoops, newBallState.speed);
	debugger
}

function adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, cornerSquareNumber){
	
	var isNearGoal = [false, false, false, false];
	
	if(lines.horizontalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(540 - newBallState.angle);
		if(cornerSquareNumber === 1 || cornerSquareNumber === 2){
			newBallState.position.y = lines.horizontalLine.point1.y + BALL_RADIUS;
		}else{
			newBallState.position.y = lines.horizontalLine.point1.y - BALL_RADIUS;
		}
	}else if(lines.diagonalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		var reflectAngle = (cornerSquareNumber === 1 || cornerSquareNumber === 4) ? 450 : 630;
		newBallState.angle = normalizeAngle(reflectAngle - newBallState.angle);
		
		//recalculate the intercept when diagonal deflection is near a goal line
		var goal1Y = getElementPropertyAsFloat("goal1", 'height');
		if(newBallState.position.y - (BALL_RADIUS * 2) < goal1Y){
			isNearGoal[0] = true;
		}
		var goal2X = getElementPropertyAsFloat("goal2", 'width');
		if(newBallState.position.x - (BALL_RADIUS * 2) < goal2X){
			isNearGoal[1] = true;
		}
		var goal3X = getElementPropertyAsFloat("goal3", 'left');
		if(newBallState.position.x + (BALL_RADIUS * 2) > goal3X){
			isNearGoal[2] = true;
		}
		var goal4Y = getElementPropertyAsFloat("goal4", 'top');
		if(newBallState.position.y + (BALL_RADIUS * 2) > goal4Y){
			isNearGoal[3] = true;
		}
		
		//to prevent glitching on the corners, bump the ball back from the collision edge by a distance equal to the perpendicular radius
		var offsetXY = Math.sqrt((BALL_RADIUS * BALL_RADIUS) / 2);
		if(cornerSquareNumber === 1){
			newBallState.position.x += offsetXY;
			newBallState.position.y += offsetXY;
		}else if(cornerSquareNumber === 2){
			newBallState.position.x -= offsetXY;
			newBallState.position.y += offsetXY;
		}else if(cornerSquareNumber === 3){
			newBallState.position.x += offsetXY;
			newBallState.position.y -= offsetXY;
		}else if(cornerSquareNumber === 4){
			newBallState.position.x -= offsetXY;
			newBallState.position.y -= offsetXY;
		}
		
	}else if(lines.verticalLine.isIntersectedByPoint(newBallState.position, BALL_RADIUS)){
		newBallState.angle = normalizeAngle(360 - newBallState.angle);
		if(cornerSquareNumber === 1 || cornerSquareNumber === 3){
			newBallState.position.x = lines.verticalLine.point1.x + BALL_RADIUS;
		}else{
			newBallState.position.x = lines.verticalLine.point1.x - BALL_RADIUS;
		}
	}
	
	return isNearGoal;
}

function adjustForBumperCollision_IsNearGoal(ballState, player){
	
	var isNearGoal = [false, false, false, false];
	
	var bumperId = 'bumper' + player;
	
	var newBallState = {
		speed: ballState.speed,
		angle: ballState.angle,
		position: ballState.position
	};
	
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
	
	if(player === 1){
		if(adjustForBumperBottom_IsIntersected(newBallState, bumperLine2)){
			
			isNearGoal[0] = true;
			
		}else if(adjustForBumperLeft_IsIntersected(newBallState, bumperLine1) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3) ||
			adjustForBumperTop_IsIntersected(newBallState, bumperLine4)){
			
		}
	}else if(player === 2){
		if(adjustForBumperRight_IsIntersected(newBallState, bumperLine3)){
			
			isNearGoal[1] = true;
			
		}else if(adjustForBumperTop_IsIntersected(newBallState, bumperLine4) ||
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2) ||
			adjustForBumperLeft_IsIntersected(newBallState, bumperLine1)){
			
		}
	}else if(player === 3){
		if(adjustForBumperLeft_IsIntersected(newBallState, bumperLine1)){
			
			isNearGoal[2] = true;
			
		}else if(adjustForBumperTop_IsIntersected(newBallState, bumperLine4) ||
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3)){
			
		}
	}else if(player === 4){
		if(adjustForBumperTop_IsIntersected(newBallState, bumperLine4)){
			
			isNearGoal[3] = true;
			
		}else if(adjustForBumperLeft_IsIntersected(newBallState, bumperLine1) ||
			adjustForBumperRight_IsIntersected(newBallState, bumperLine3) ||
			adjustForBumperBottom_IsIntersected(newBallState, bumperLine2)){
			
		}
	}
	
	return isNearGoal;
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

// ============================================
// UI Event Handlers
// ============================================
document.getElementById('trainModelBtn').addEventListener('click', async () => {
	document.getElementById('trainModelBtn').firstElementChild.style.display = "inline-block";
	document.getElementById('trainModelBtn').disabled = true;
	document.getElementById('exportModelBtn').disabled = true;
	document.getElementById('trainModelMessage').innerHTML = 'Training...';
	
	await INTERCEPT_PREDICTOR.trainModel();
	
	document.getElementById('trainModelBtn').firstElementChild.style.display = "none";
	document.getElementById('trainModelBtn').disabled = false;
	document.getElementById('exportModelBtn').disabled = false;
	document.getElementById('exportModelBtn').style.display = "inline-block";
	document.getElementById('trainModelMessage').innerHTML = 'Model training is complete. Model will be used by AI players.';
});

document.getElementById('startGameBtn').addEventListener('click', async () => {
	document.getElementById('titleScreenContainer').style.display = "none";
	document.querySelectorAll(".predictBall").forEach(el => {
		el.style.display = "none"
	});
	
	await board.initGame();
	
	for (const player of [board.player1, board.player2, board.player3, board.player4]) {
		if (player.intercept_predictor) {
			//import saved model
			const jsonFile = document.getElementById('upload-json').files[0];
			const weightsFile = document.getElementById('upload-weights').files[0];
			if(jsonFile && weightsFile){
				const model = await tf.loadLayersModel(
					tf.io.browserFiles([jsonFile, weightsFile])
				);
				player.intercept_predictor.loadModel(model);
			}
		}
	}
});

document.getElementById('exportModelBtn').addEventListener('click', async () => {
	for (const player of [board.player1, board.player2, board.player3, board.player4]) {
		if (player.intercept_predictor) {
			await player.intercept_predictor.saveModel('downloads://intercept-predictor-model');
			break;
		}
	}
});

// ============================================
// Player Creation
// ============================================
function createPlayer(playerNumber, speed = MIN_BALL_SPEED, isHuman = false, isAI = false){
	var player = {
		playerNumber: 0,
		isHuman: false,
		isAI: false,
		score: 0,
		slideSpeed: 0,
		movingDirection: null,
		intercept_predictor: null,
		shouldRecalculateIntercept: false,
		nextInterceptPosition: null,
		framesToArrival: 0,
		startSlide: function(direction){
			var _self = this;
			//console.log("startSlide(" + direction + ")");
			_self.movingDirection = direction;
		},
		getBumperXCanonical: function(){
			var _self = this;
			
			var bumperLateralPosition = 0;
			
			if(_self.playerNumber == 1 || _self.playerNumber == 4){
			
				//300-700
				bumperLateralPosition = getElementPropertyAsFloat("bumper" + _self.playerNumber, 'left') + getElementPropertyAsFloat("bumper" + _self.playerNumber, 'width') / 2;
				
				if(_self.playerNumber == 1){
					//700-300
					bumperLateralPosition = BOARD_WIDTH - bumperLateralPosition;
				}
				
			}else if(_self.playerNumber == 2 || _self.playerNumber == 3){
				
				//300-700
				bumperLateralPosition = getElementPropertyAsFloat("bumper" + _self.playerNumber, 'top') + getElementPropertyAsFloat("bumper" + _self.playerNumber, 'height') / 2;
				
				if(_self.playerNumber == 3){
					//700-300
					bumperLateralPosition = BOARD_WIDTH - bumperLateralPosition;
				}
				
			}
			
			return bumperLateralPosition;
		},
		getBallPositionCanonical: function(ballPosition){
			const _self = this;
			
			var adjustedPosition = new Point(0, 0);
			
			if(_self.playerNumber == 4){
				//0-1000, 0-1000
				adjustedPosition = new Point(ballPosition.x, ballPosition.y);
			}else if(_self.playerNumber == 1){
				//1000-0, 1000-0
				adjustedPosition = new Point(BOARD_WIDTH - ballPosition.x, BOARD_HEIGHT - ballPosition.y);
			}else if(_self.playerNumber == 2){
				//rotating counterclockwise
				adjustedPosition = new Point(ballPosition.y, BOARD_WIDTH - ballPosition.x);
			}else if(_self.playerNumber == 3){
				//rotating clockwise
				adjustedPosition = new Point(BOARD_HEIGHT - ballPosition.y, ballPosition.x);
			}
			
			return adjustedPosition;
		},
		getBallVelocityCanonical: function(ballState){
			const _self = this;
			
			var nextBallPosition = getNewPositionFromAngleAndSpeed(ballState.position, ballState.angle, ballState.speed);
			
			//player 4
			var ball_velocity_x = nextBallPosition.x - ballState.position.x;
			var ball_velocity_y = nextBallPosition.y - ballState.position.y;
			
			if(_self.playerNumber == 1){
				//inverted
				var ballVelocityXRotated = (-1) * ball_velocity_x;
				var ballVelocityYRotated = (-1) * ball_velocity_y;
				ball_velocity_x = ballVelocityXRotated;
				ball_velocity_y = ballVelocityYRotated;
			}else if(_self.playerNumber == 2){
				//rotating counterclockwise
				var ballVelocityXRotated = ball_velocity_y;
				var ballVelocityYRotated = (-1) * ball_velocity_x;
				ball_velocity_x = ballVelocityXRotated;
				ball_velocity_y = ballVelocityYRotated;
			}else if(_self.playerNumber == 3){
				//rotating clockwise
				var ballVelocityXRotated = (-1) * ball_velocity_y;
				var ballVelocityYRotated = ball_velocity_x;
				ball_velocity_x = ballVelocityXRotated;
				ball_velocity_y = ballVelocityYRotated;
			}
			
			return new Point(ball_velocity_x, ball_velocity_y);
		},
		getBumperMoveTowardTarget: function(bumper_x_normalized, target_x_normalized){
			//stay
			var move = 1;
			if(target_x_normalized + BALL_RADIUS_NORMALIZED < bumper_x_normalized){
				//left
				move = 0;
			}else if(target_x_normalized - BALL_RADIUS_NORMALIZED > bumper_x_normalized){
				//right
				move = 2;
			}
			
			return move;
		},
		getMoveFromAI: function(bumper_x_normalized, ball_x_normalized, ball_y_normalized, ball_velocity_x_normalized, ball_velocity_y_normalized){
			var _self = this;
			
			const state = [ball_x_normalized, ball_y_normalized, ball_velocity_x_normalized, ball_velocity_y_normalized];
			const x_pred = _self.intercept_predictor.predictX(state);
			
			// Return action: 0=left, 1=stay, 2=right
			return getBumperMoveTowardTarget(bumper_x_normalized, x_pred);
		},
		iterateSlide: async function(){
			var _self = this;
			
			if(!_self.isHuman){
				
				const bumper_x_normalized = normalizeBumperX(_self.getBumperXCanonical());
				const ball_xy_normalized = normalizeBallPosition(_self.getBallPositionCanonical(board.ball.ballState.position));
				const ball_velocity_xy_normalized = normalizeBallVelocity(_self.getBallVelocityCanonical(board.ball.ballState));
				
				var move = 1;
				
				if(_self.isAI){
					
					//neural network
					move = _self.getMoveFromAI(bumper_x_normalized, ball_xy_normalized.x, ball_xy_normalized.y, ball_velocity_xy_normalized.x, ball_velocity_xy_normalized.y);
					
				}else if(!_self.isHuman){
					
					//hardcoded CPU
					move = _self.getBumperMoveTowardTarget(bumper_x_normalized, ball_xy_normalized.x);
					
				}
				
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
			
		},
		stopSlide: function(){
			var _self = this;
			_self.movingDirection = null;
		},
		processScore: function(){
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
			if(_self.playerNumber != board.isGoalLineCrossed){
				//verify the ball goes out of bounds shortly after crossing the goal line
				console.log(board.isGoalLineCrossed, _self.playerNumber);
			}
			board.isGoalLineCrossed = null;
			
			board.ball.resetBall();
		},
		drawNextIntercept: function(){
			const _self = this;
			
			var nextInterceptPosition = predictBallIntercept(_self.playerNumber, board.ball.ballState);
			const predictBallElement = document.getElementById("predictBall" + _self.playerNumber);
			predictBallElement.style.left = (nextInterceptPosition.x - BALL_RADIUS) + "px";
			predictBallElement.style.top = (nextInterceptPosition.y - BALL_RADIUS) + "px";
			
			_self.nextInterceptPosition = nextInterceptPosition;
		}
	};
	
	player.playerNumber = playerNumber;
	player.slideSpeed = speed;
	player.isHuman = isHuman;
	player.isAI = isAI;
	
	// Initialize model for AI players
	if (player.isAI) {
		player.intercept_predictor = INTERCEPT_PREDICTOR;
	}
	
	if(isHuman){
		
		document.addEventListener('keydown', function(event) {
			if (event.repeat) { return; }
			
			if(event.keyCode == 37) {
				player.startSlide(DIRECTIONS.LEFT);
			} else if(event.keyCode == 39) {
				player.startSlide(DIRECTIONS.RIGHT);
			}
		});
		
		document.addEventListener('keyup', function(event) {
			if (event.repeat) { return; }
			
			switch (event.keyCode){
				case 37:
				case 39:
					player.stopSlide();
					break;
				default:
					return;
			}
		});
		
	}
	
	return player;
}

var ball = {
	ballState: {
		speed: 0,
		angle: 0,
		/*spin:{
			clockwise: true,
			speed: 10
		},*/
		//position of the center of the ball
		position: null
	},
	ballElement: null,
	getBallElement: function(){
		if(this.ballElement == null){
			this.ballElement = document.getElementById("ball");
		}
		return this.ballElement;
	},
	increaseSpeed: function(increment = 5){
		var _self = this;
		_self.ballState.speed += increment;
	},
	resetBall: function(){
		var _self = this;
		
		//initialize new ball
		_self.ballState.speed = MIN_BALL_SPEED;
		
		_self.ballState.angle = getRandomAngle();
		
		var randomX = (BOARD_WIDTH / 2) - (BOARD_WIDTH / 8) + getRandomNumber(0, BOARD_WIDTH/4);
		var randomY = (BOARD_HEIGHT / 2) - (BOARD_HEIGHT / 8) + getRandomNumber(0, BOARD_HEIGHT/4);
		_self.ballState.position = new Point(randomX, randomY);
		
		board.player1.drawNextIntercept();
		board.player2.drawNextIntercept();
		board.player3.drawNextIntercept();
		board.player4.drawNextIntercept();
		
	},
	setRecalculateIfNearGoal: function(isNearGoalArray){
		if(isNearGoalArray[0]){
			board.player1.shouldRecalculateIntercept = true;
		}
		if(isNearGoalArray[1]){
			board.player2.shouldRecalculateIntercept = true;
		}
		if(isNearGoalArray[2]){
			board.player3.shouldRecalculateIntercept = true;
		}
		if(isNearGoalArray[3]){
			board.player4.shouldRecalculateIntercept = true;
		}
	},
	updateBallState: function(){
		var _self = this;
		
		var currentPosition = new Point(_self.ballState.position.x, _self.ballState.position.y);
		
		const topBoundary = 0;
		const bottomBoundary = getElementPropertyAsFloat('board', 'height');
		const leftBoundary = 0;
		const rightBoundary = getElementPropertyAsFloat('board', 'width');
		
		var newBallState = {
			speed: _self.ballState.speed,
			angle: _self.ballState.angle,
			position: currentPosition
		};
		
		//to prevent clipping through edges at higher speeds, divide the distance to move into steps that are smaller than the collision radius and check for collisions at each step before finalizing the new ball position
		var numberOfLoops = parseInt(_self.ballState.speed / (BALL_RADIUS - 1)) + 1;
		for(var x=0; x<numberOfLoops; x++){
			
			var stepSpeed = _self.ballState.speed / numberOfLoops;
			
			//calculate new position before checking for boundary intersections
			var newPosition = getNewPositionFromAngleAndSpeed(newBallState.position, _self.ballState.angle, stepSpeed);
			
			newBallState.position = newPosition;
			
			//recalculate new position based on boundary intersections
			
			//check for goal line crossing
			if(board.isGoalLineCrossed == null){
				if(newBallState.position.y < topBoundary + GOAL_DEPTH - BALL_RADIUS){
					board.isGoalLineCrossed = 1;
				}else if(newBallState.position.x < leftBoundary + GOAL_DEPTH - BALL_RADIUS){
					board.isGoalLineCrossed = 2;
				}else if(newBallState.position.x > rightBoundary - GOAL_DEPTH + BALL_RADIUS){
					board.isGoalLineCrossed = 3;
				}else if(newBallState.position.y > bottomBoundary - GOAL_DEPTH + BALL_RADIUS){
					board.isGoalLineCrossed = 4;
				}
			}
			
			//check for score
			if(newBallState.position.y < topBoundary - BALL_RADIUS){
				board.player1.processScore();
				return;
			}else if(newBallState.position.x < leftBoundary - BALL_RADIUS){
				board.player2.processScore();
				return;
			}else if(newBallState.position.x > rightBoundary + BALL_RADIUS){
				board.player3.processScore();
				return;
			}else if(newBallState.position.y > bottomBoundary + BALL_RADIUS){
				board.player4.processScore();
				return;
			}
			
			var lines = {
				horizontalLine: null,
				diagonalLine: null,
				verticalLine: null
			};
			
			var cornerSquareWidth = getElementPropertyAsFloat('cornerSquare1', 'width');
			var cornerSquareHeight = cornerSquareWidth;
			
			//Square 1
			var cornerSquare1Left = getElementPropertyAsFloat('cornerSquare1', 'left');
			var cornerSquare1Top = getElementPropertyAsFloat('cornerSquare1', 'top');
			
			var cornerSquare1Point1 = new Point(cornerSquare1Left, cornerSquare1Top + cornerSquareHeight);
			var cornerSquare1Point2 = new Point(cornerSquare1Left + (cornerSquareWidth / 2), cornerSquare1Top + cornerSquareHeight);
			var cornerSquare1Point3 = new Point(cornerSquare1Left + cornerSquareWidth, cornerSquare1Top + (cornerSquareHeight / 2));
			var cornerSquare1Point4 = new Point(cornerSquare1Left + cornerSquareWidth, cornerSquare1Top);
			
			lines = {
				horizontalLine: new Line(cornerSquare1Point1, cornerSquare1Point2),
				diagonalLine: new Line(cornerSquare1Point2, cornerSquare1Point3),
				verticalLine: new Line(cornerSquare1Point3, cornerSquare1Point4)
			};
			this.setRecalculateIfNearGoal(adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 1));
			
			//Square 2
			var cornerSquare2Left = getElementPropertyAsFloat('cornerSquare2', 'left');
			var cornerSquare2Top = getElementPropertyAsFloat('cornerSquare2', 'top');
			
			var cornerSquare2Point1 = new Point(cornerSquare2Left, cornerSquare2Top);
			var cornerSquare2Point2 = new Point(cornerSquare2Left, cornerSquare2Top + (cornerSquareHeight / 2));
			var cornerSquare2Point3 = new Point(cornerSquare2Left + (cornerSquareWidth / 2), cornerSquare2Top + cornerSquareHeight);
			var cornerSquare2Point4 = new Point(cornerSquare2Left + cornerSquareWidth, cornerSquare2Top + cornerSquareHeight);
			
			lines = {
				horizontalLine: new Line(cornerSquare2Point3, cornerSquare2Point4),
				diagonalLine: new Line(cornerSquare2Point2, cornerSquare2Point3),
				verticalLine: new Line(cornerSquare2Point1, cornerSquare2Point2)
			};
			this.setRecalculateIfNearGoal(adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 2));
			
			//Square 3
			var cornerSquare3Left = getElementPropertyAsFloat('cornerSquare3', 'left');
			var cornerSquare3Top = getElementPropertyAsFloat('cornerSquare3', 'top');
			
			var cornerSquare3Point1 = new Point(cornerSquare3Left, cornerSquare3Top);
			var cornerSquare3Point2 = new Point(cornerSquare3Left + (cornerSquareWidth / 2), cornerSquare3Top);
			var cornerSquare3Point3 = new Point(cornerSquare3Left + cornerSquareWidth, cornerSquare3Top + (cornerSquareHeight / 2));
			var cornerSquare3Point4 = new Point(cornerSquare3Left + cornerSquareWidth, cornerSquare3Top + cornerSquareHeight);
			
			lines = {
				horizontalLine: new Line(cornerSquare3Point1, cornerSquare3Point2),
				diagonalLine: new Line(cornerSquare3Point2, cornerSquare3Point3),
				verticalLine: new Line(cornerSquare3Point3, cornerSquare3Point4)
			};
			this.setRecalculateIfNearGoal(adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 3));
			
			//Square 4
			var cornerSquare4Left = getElementPropertyAsFloat('cornerSquare4', 'left');
			var cornerSquare4Top = getElementPropertyAsFloat('cornerSquare4', 'top');
			
			var cornerSquare4Point1 = new Point(cornerSquare4Left, cornerSquare4Top + cornerSquareHeight);
			var cornerSquare4Point2 = new Point(cornerSquare4Left, cornerSquare4Top + (cornerSquareHeight / 2));
			var cornerSquare4Point3 = new Point(cornerSquare4Left + (cornerSquareWidth / 2), cornerSquare4Top);
			var cornerSquare4Point4 = new Point(cornerSquare4Left + cornerSquareWidth, cornerSquare4Top);
			
			lines = {
				horizontalLine: new Line(cornerSquare4Point3, cornerSquare4Point4),
				diagonalLine: new Line(cornerSquare4Point2, cornerSquare4Point3),
				verticalLine: new Line(cornerSquare4Point1, cornerSquare4Point2)
			};
			this.setRecalculateIfNearGoal(adjustForCornerSquareCollision_IsNearGoal(newBallState, lines, 4));
			
			//Bumpers
			this.setRecalculateIfNearGoal(adjustForBumperCollision_IsNearGoal(newBallState, 1));
			
			this.setRecalculateIfNearGoal(adjustForBumperCollision_IsNearGoal(newBallState, 2));
			
			this.setRecalculateIfNearGoal(adjustForBumperCollision_IsNearGoal(newBallState, 3));
			
			this.setRecalculateIfNearGoal(adjustForBumperCollision_IsNearGoal(newBallState, 4));
			
			//update ball state with new values
			_self.ballState = newBallState;
		}
	},
	drawBall: function(){
		var _self = this;
		
		var ballElement = _self.getBallElement();
		ballElement.style.left = (_self.ballState.position.x - BALL_RADIUS) + "px";
		ballElement.style.top = (_self.ballState.position.y - BALL_RADIUS) + "px";
		//ballElement.style.transform = newSpin?
		
		var statsElement = document.getElementById("ballStats");
		statsElement.textContent = "x:" + parseInt(_self.ballState.position.x) + " y:" + parseInt(_self.ballState.position.y) + " θ:" + _self.ballState.angle + "°";
	}
};

var board = {
	player1: null,
	player2: null,
	player3: null,
	player4: null,
	ball: ball,
	isStarted: false,
	gameLoop: null,
	initGame: async function(){
		var _self = this;
		
		document.querySelectorAll(".switch-toggle input:checked").forEach(el => {
			
			var elementId = el.id;
			var selection_playerNumber = elementId.split("_");
			var selection = selection_playerNumber[0];
			var playerNumber = selection_playerNumber[1];
			
			var isHuman = selection === 'p';
			var isAi = selection === 'ai';
			
			if(playerNumber === '1'){
				
				_self.player1 = createPlayer(1, 25, isHuman, isAi);
				
			}else if(playerNumber === '2'){
			
				_self.player2 = createPlayer(2, 25, isHuman, isAi);
				
			}else if(playerNumber === '3'){
				
				_self.player3 = createPlayer(3, 25, isHuman, isAi);
				
			}else if(playerNumber === '4'){
			
				_self.player4 = createPlayer(4, 25, isHuman, isAi);
				
			}
			
			document.querySelector('#bumper' + playerNumber + ' .playerLabel').innerHTML = elementId.toUpperCase();
			
		});
		
		_self.ball.resetBall();
		
		await _self.startGame();
	},
	startGame: async function(){
		var _self = this;
		
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
	},
	stopGame: function(){
		var _self = this;
		clearInterval(_self.gameLoop);
		_self.isStarted = false;
	},
	recalculateIntercepts: function(){
		var _self = this;
		
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
		
	},
	isGoalLineCrossed: null
};

document.addEventListener('keyup', async function(event) {
	if (event.repeat) { return; }
	
	switch (event.keyCode){
		case 32:
			//spacebar
			if(board.isStarted){
				board.stopGame();
			}else{
				await board.startGame();
			}
		default:
			return;
	}
});

//await board.player4.intercept_predictor.saveModel('localstorage://intercept-predictor-model');