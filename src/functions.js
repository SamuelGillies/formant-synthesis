export function scaleNumber(input, inputRange, outputRange, decInt) { 
		let scaledValue = (input - inputRange[0]) * (outputRange[1] - outputRange[0]) 
											/ (inputRange[1] - inputRange[0]) + outputRange[0];
		
		if ((scaledValue <= outputRange[1]) && (scaledValue => outputRange[0])) {
				return scaledValue.toFixed(decInt); 
		} else if (scaledValue > outputRange[1]) {
				return outputRange[1].toFixed(decInt); 
		} else if (scaledValue < outputRange[0]) {
				return outputRange[0].toFixed(decInt);
		}
}
