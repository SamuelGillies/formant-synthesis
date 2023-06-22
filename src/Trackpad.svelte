<script>
	import { onMount, afterUpdate } from 'svelte';
	import { scaleNumber } from './functions'; 
	import { x, y } from './app.js';
		
	const Range = {
		xmin: 0., 
		xmax: 1.,
		ymin: 0., 
		ymax: 1.
	}; 
	
	let trackpad, handle, container, trackpadWidth, trackpadHeight, handleHeight; 
	let posX = 1, posY = 1; 
	let clickState = false; 
	
	function clickOn(event) {
		clickState = true; 
		let rect = trackpad.getBoundingClientRect();
    posX = event.clientX - rect.left;
    posY = event.clientY - rect.top;
		moveHandle(posX, posY); 
	}
	
	function clickOff() {
		clickState = false; 
	}
	
	function mouseMovement(event) {
		const rect = trackpad.getBoundingClientRect();
		if (clickState === true) {
    	posX = event.clientX - rect.left;
    	posY = event.clientY - rect.top;
			moveHandle(posX, posY); 
		}
	}

	function moveHandle(moveX, moveY) {
		let rect = trackpad.getBoundingClientRect();
		let rectWidth = rect.width; 
		// x values
		if (moveX < (handleHeight / 2))  {
      moveX = 0;
		} else if (moveX > (rect.width + handleHeight)) {
      moveX = rect.width + handleHeight;
    } else {
      moveX = moveX;
    }; 
		// y values
    if (moveY < (handleHeight / 2)) {
      moveY = 0;
    } else if (moveY > (rect.height + handleHeight)) {
      moveY = rect.height + handleHeight;
    } else {
      moveY = moveY;
    }; 
		
		handle.style.left = moveX + 'px';
    handle.style.top = moveY + 'px';	

		x.update(x => x = scaleNumber(moveX, [0, trackpadWidth], [Range.xmin, Range.xmax], 2));
		y.update(y => y = scaleNumber(moveY, [0, trackpadHeight], [Range.ymin, Range.ymax], 2)); 
  }

	onMount(async () => {
		let startWidth = trackpadWidth / 2; 
		let startHeight = trackpadHeight / 2; 
		posX = startWidth; 
		posY = startHeight; 
		moveHandle(startWidth, startHeight); 
	}); 
	
	afterUpdate(() => {
    if (trackpad) {
			x.subscribe(value => {
				let subX = scaleNumber(value, [Range.xmin, Range.xmax], [0, trackpadWidth], 2);
				let rect = trackpad.getBoundingClientRect();
				if (subX < (handleHeight / 2))  {
					subX = 0;
				} else if (subX > (rect.width - handleHeight)) {
					subX = rect.width - (handleHeight * 1.5);
				} else {
					subX = subX - (handleHeight / 2);
				}; 
				handle.style.left = subX + 'px';
			});
			y.subscribe(value => {
				let subY = scaleNumber(value, [Range.ymin, Range.ymax], [0, trackpadWidth], 2);
				let rect = trackpad.getBoundingClientRect();
				if (subY < (handleHeight / 2)) {
					subY = 0;
				} else if (subY > (rect.height - handleHeight)) {
					subY = rect.height - (handleHeight * 1.5);
				} else {
					subY = subY - (handleHeight / 2);
				}; 
				handle.style.top = subY + 'px';
			});	
		}
  });
	
</script>

<div class="trackpadContainer" bind:this={container} on:mousedown={clickOn} on:mousemove={mouseMovement} on:mouseup={clickOff} >
	<div class="trackpad" bind:this={trackpad} bind:clientWidth={trackpadWidth} bind:clientHeight={trackpadHeight}>
		<div class='handle' bind:this={handle} bind:clientHeight={handleHeight}></div>
	</div>
</div>

<style>	
	.trackpadContainer {
		display: flex; 
		flex-direction: column; 
		justify-content: center; 
		align-items: center; 
		padding: 20px; 
	}
	
	.trackpad {
		width: 50vh; 
		height: 50vh;
		background-color: white; 
		border: 1pt black solid; 
		border-radius: 16px; 
	}
	
	.handle {
		width: 20px; 
		height: 20px;
		background-color: white; 
		border: 2pt black solid; 
		position: relative; 
		border-radius: 50px; 
	}
</style>

