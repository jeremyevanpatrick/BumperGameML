
function createAndExportValidationSet(){
	const inputs_labels = generateInputsAndLabels(100000);
	
	const jsonString = JSON.stringify(inputs_labels, null, 2);
	const blob = new Blob([jsonString], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "validationData.js";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function getAverageFromArray(array){
	const total = array.reduce((acc, val) => acc + val, 0);
	const average = array.length > 0 ? total / array.length : 0;
	return average;
}

function plotTrainingLossGraph(labels, predictions, plotName, range){
	
	const traces = [
		{
			x: [],
			y: [],
			mode: 'lines',
			name: 'Training Loss'
		},
		{
			x: [],
			y: [],
			mode: 'lines',
			name: 'Validation Loss'
		}
	];
	
	const layout = {
		title: 'Training Progress',
		width: 350,
		height: 250,
		xaxis: {
			title: 'Iteration',
			rangemode: 'tozero'
		},
		yaxis: {
			title: 'Loss',
			rangemode: 'tozero'
		}
	};

	Plotly.newPlot('trainingLossGraph', traces, layout);
}

function extendTracesForTrainingLossGraph(iteration, training_loss, validation_loss){
	Plotly.extendTraces(
		'trainingLossGraph',
		{
			x: [[iteration], [iteration]],
			y: [[training_loss], [validation_loss]]
		},
		[0, 1]
	);
}

function plotPredictedActualScatterPlot(labels, predictions, plotName, range){
	
	const traces = [
		{
			x: labels,
			y: predictions,
			mode: 'markers',
			type: 'scatter',
			showlegend: false,
			name: 'Model predictions (' + predictions.length + ')'
		},
		{
			x: range,
			y: range,
			mode: 'lines',
			type: 'scatter',
			showlegend: false,
			name: 'Ideal (y = x)',
			line: {
				dash: 'dash',
				color: 'green'
			}
		}
	];
	
	const layout = {
		title: 'Actual vs Predicted '+plotName,
		width: 350,
		height: 350,
		showlegend: false,
		xaxis: {
			title: 'Actual',
			range: range,
			autorange: false,
			fixedrange: true
		},
		yaxis: {
			title: 'Predicted',
			range: range,
			autorange: false,
			fixedrange: true,
			scaleanchor: 'x',
			scaleratio: 1
		},
		margin: {
			t: 40,
			l: 50,
			r: 20,
			b: 50
		}
	};

	Plotly.newPlot('predictedActualScatterPlot'+plotName, traces, layout);
}

function plotResidualHistogram(labels, predictions, plotName, range){
	const residuals = labels.map((actual, i) => {
		return predictions[i] - actual;
	});
	
	const traces = [{
		x: residuals,
		type: 'histogram',
		nbinsx: 40
	}];
	
	const layout = {
		title: 'Residual Distribution '+plotName,
		width: 350,
		height: 350,
		showlegend: false,
		xaxis: {
			title: 'Prediction Error'
		},
		yaxis: {
			title: 'Count'
		}
	};
	
	Plotly.newPlot('residualHistogram'+plotName, traces, layout);
}

function plotResidualActualScatterPlot(labels, predictions, plotName, range){
	const residuals = labels.map((actual, i) => {
		return predictions[i] - actual;
	});
	
	const traces = [
		{
			x: labels,
			y: residuals,
			mode: 'markers',
			type: 'scatter',
			name: 'Residuals'
		},
		{
			x: range,
			y: [0, 0],
			mode: 'lines',
			type: 'scatter',
			name: 'Zero error',
			line: {
				dash: 'dash',
				color: 'green'
			}
		}
	];

	const layout = {
		title: 'Residual vs Actual '+plotName,
		width: 350,
		height: 350,
		showlegend: false,
		xaxis: {
			title: 'Actual',
			range: range
		},
		yaxis: {
			title: 'Residual (prediction - actual)'
		}
	};

	Plotly.newPlot('residualActualScatterPlot'+plotName, traces, layout);
}

function plotRolloutPlot(bounce_numbers, avg_errors, plotName, range){
	const traces = [
		{
			x: bounce_numbers,
			y: avg_errors,
			mode: 'lines+markers',
			type: 'scatter'
		}
	];
	
	const layout = {
		title: 'Error vs Number of Bounces '+plotName,
		width: 350,
		height: 350,
		showlegend: false,
		xaxis: {
			title: 'Number of bounces'
		},
		yaxis: {
			title: 'Average error'
		}
	};
	
	Plotly.newPlot('rolloutPlot'+plotName, traces, layout);
}

function buildRolloutPlots(intercept_predictor, inputs){
	//Rollout logic
	const goalline_margin_of_error_normalized = (BALL_RADIUS + 1) / PLAYABLE_AREA_WIDTH;
	const max_bounce_number = 40;
	
	var bounce_numbers = []
	var x_errors_at_bounce = [];
	var y_errors_at_bounce = [];
	var vx_errors_at_bounce = [];
	var vy_errors_at_bounce = [];
	
	for(var x=0;x < inputs.length; x++){
		
		var predicted_state = inputs[x];
		var actual_state = inputs[x];
		
		var bounce_number = 0;
		
		while(!isGoallineBounce(actual_state) && bounce_number < max_bounce_number){
			
			predicted_state = intercept_predictor.predictNextState(predicted_state);
			actual_state = calculateNextState(actual_state);
			
			if(actual_state === undefined){
				//if calculation fails, end the current rally
				break;
			}
			
			if(bounce_numbers[bounce_number] === undefined){
				bounce_numbers[bounce_number] = bounce_number;
			}
			
			if(x_errors_at_bounce[bounce_number] === undefined){
				x_errors_at_bounce[bounce_number] = [];
			}
			x_errors_at_bounce[bounce_number].push(Math.abs(predicted_state[0] - actual_state[0]));
			
			if(y_errors_at_bounce[bounce_number] === undefined){
				y_errors_at_bounce[bounce_number] = [];
			}
			y_errors_at_bounce[bounce_number].push(Math.abs(predicted_state[1] - actual_state[1]));
			
			if(vx_errors_at_bounce[bounce_number] === undefined){
				vx_errors_at_bounce[bounce_number] = [];
			}
			vx_errors_at_bounce[bounce_number].push(Math.abs(predicted_state[2] - actual_state[2]));
			
			if(vy_errors_at_bounce[bounce_number] === undefined){
				vy_errors_at_bounce[bounce_number] = [];
			}
			vy_errors_at_bounce[bounce_number].push(Math.abs(predicted_state[3] - actual_state[3]));
			
			bounce_number++;
		}
	}
	
	const avg_x_error_at_bounce = [];
	const avg_y_error_at_bounce = [];
	const avg_vx_error_at_bounce = [];
	const avg_vy_error_at_bounce = [];
	
	for(var x=0; x<bounce_numbers.length; x++){
		avg_x_error_at_bounce[x] = getAverageFromArray(x_errors_at_bounce[x]);
		avg_y_error_at_bounce[x] = getAverageFromArray(y_errors_at_bounce[x]);
		avg_vx_error_at_bounce[x] = getAverageFromArray(vx_errors_at_bounce[x]);
		avg_vy_error_at_bounce[x] = getAverageFromArray(vy_errors_at_bounce[x]);
	}
	
	plotRolloutPlot(bounce_numbers, avg_x_error_at_bounce, "X", [0, max_bounce_number]);
	plotRolloutPlot(bounce_numbers, avg_y_error_at_bounce, "Y", [0, max_bounce_number]);
	plotRolloutPlot(bounce_numbers, avg_vx_error_at_bounce, "VX", [0, max_bounce_number]);
	plotRolloutPlot(bounce_numbers, avg_vy_error_at_bounce, "VY", [0, max_bounce_number]);
}

document.getElementById('analyzeModelBtn').addEventListener('click', async () => {
	
	document.getElementById('analyzeModelBtn').firstElementChild.style.display = "inline-block";
	document.getElementById('analyzeModelBtn').disabled = true;
	
	//force UI changes first
	await new Promise(requestAnimationFrame);
	
	//import model from localstorage
	const models = await tf.io.listModels();
	if(models[LOCAL_STORAGE_PATH]){
		
		const intercept_predictor = new InterceptPredictor();
		await intercept_predictor.loadModel(LOCAL_STORAGE_PATH);
		
		const inputs_labels = generateInputsAndLabels(100);
		const inputs = inputs_labels[0];
		const labels = inputs_labels[1];
		
		//log the validation loss
		if(typeof VALIDATION_DATA !== 'undefined'){
			const validationXs = tf.tensor2d(VALIDATION_DATA[0]);
			const validationYs = tf.tensor2d(VALIDATION_DATA[1]);
			var validation_loss = intercept_predictor.evaluateModel(validationXs, validationYs);
			console.log(`validation=${validation_loss.toFixed(6)}`);
		}
		
		const predictions = intercept_predictor.predictBatchOfStates(inputs);
		
		const labels_x = labels.map(p => p[0]);
		const labels_y = labels.map(p => p[1]);
		const labels_vx = labels.map(p => p[2]);
		const labels_vy = labels.map(p => p[3]);
		
		const predictions_x = predictions.map(p => p[0]);
		const predictions_y = predictions.map(p => p[1]);
		const predictions_vx = predictions.map(p => p[2]);
		const predictions_vy = predictions.map(p => p[3]);
		
		plotPredictedActualScatterPlot(labels_x, predictions_x, "X", [-0.5, 0.5]);
		plotPredictedActualScatterPlot(labels_y, predictions_y, "Y", [-0.5, 0.5]);
		plotPredictedActualScatterPlot(labels_vx, predictions_vx, "VX", [-1, 1]);
		plotPredictedActualScatterPlot(labels_vy, predictions_vy, "VY", [-1, 1]);
		
		plotResidualHistogram(labels_x, predictions_x, "X", [-0.5, 0.5]);
		plotResidualHistogram(labels_y, predictions_y, "Y", [-0.5, 0.5]);
		plotResidualHistogram(labels_vx, predictions_vx, "VX", [-1, 1]);
		plotResidualHistogram(labels_vy, predictions_vy, "VY", [-1, 1]);
		
		plotResidualActualScatterPlot(labels_x, predictions_x, "X", [-0.5, 0.5]);
		plotResidualActualScatterPlot(labels_y, predictions_y, "Y", [-0.5, 0.5]);
		plotResidualActualScatterPlot(labels_vx, predictions_vx, "VX", [-1, 1]);
		plotResidualActualScatterPlot(labels_vy, predictions_vy, "VY", [-1, 1]);
		
		buildRolloutPlots(intercept_predictor, inputs);
		
	}
	
	document.getElementById('analysisScreenContainer').style.display = "inline-block";
	document.getElementById('analyzeModelBtn').firstElementChild.style.display = "none";
	document.getElementById('analyzeModelBtn').disabled = false;
	
});

document.getElementById('visualizationsCloseBtn').addEventListener('click', async () => {
	document.getElementById('analysisScreenContainer').style.display = "none";
});