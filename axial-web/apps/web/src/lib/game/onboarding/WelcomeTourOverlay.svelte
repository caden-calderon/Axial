<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ArrowLeft, ArrowRight, Check, X } from '@lucide/svelte';
	import {
		WELCOME_TOUR_STEP_COUNT,
		WELCOME_TOUR_STEPS,
		type WelcomeTourStep,
		type WelcomeTourPlacement
	} from './welcomeTourSteps';
	import TypedTourHeading from './TypedTourHeading.svelte';

	let {
		onComplete,
		onSkip,
		onPanelExpandedChange
	}: {
		onComplete: () => void;
		onSkip: () => void;
		onPanelExpandedChange: (expanded: boolean | null) => void;
	} = $props();

	type Rect = {
		x: number;
		y: number;
		width: number;
		height: number;
	};

	type CardPlacement = {
		x: number;
		y: number;
		transform: string;
	};

	const cardWidth = 548;
	const cardHeightEstimate = 342;
	const viewportMargin = 14;
	const popoverGap = 18;
	const initialViewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
	const initialViewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;

	let stepIndex = $state(0);
	let targetRect = $state<Rect | null>(null);
	let viewportWidth = $state(initialViewportWidth);
	let viewportHeight = $state(initialViewportHeight);
	let headingSettled = $state(false);
	let rafId = 0;
	let sweepToken = 0;
	let sweepRafId = 0;
	let sweepTimeouts: ReturnType<typeof setTimeout>[] = [];
	let cardGlowFrame = 0;
	let glowCurrent = { x: 50, y: 0, edge: 0 };
	let glowTarget = { x: 50, y: 0, edge: 0 };
	let headingRevealToken = 0;
	let tourDialog: HTMLElement | null = null;
	let tourCard: HTMLElement | null = null;

	const currentStep = $derived(WELCOME_TOUR_STEPS[stepIndex] as WelcomeTourStep);
	const isFirstStep = $derived(stepIndex === 0);
	const isLastStep = $derived(stepIndex === WELCOME_TOUR_STEP_COUNT - 1);
	const progressLabel = $derived(`${stepIndex + 1} / ${WELCOME_TOUR_STEP_COUNT}`);
	const hasSpotlight = $derived(targetRect !== null && currentStep.placement !== 'center');
	const spotlightStyle = $derived(rectToStyle(targetRect));
	const cardPlacement = $derived(
		resolveCardPlacement(targetRect, viewportWidth, viewportHeight, currentStep.placement ?? 'auto')
	);
	const cardStyle = $derived(
		`--tour-card-x: ${cardPlacement.x}px; --tour-card-y: ${cardPlacement.y}px; --tour-card-width: ${effectiveCardWidth(viewportWidth)}px; --tour-card-transform: ${cardPlacement.transform};`
	);

	onMount(() => {
		tourDialog?.focus();
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
		startTargetTracking();

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (cardGlowFrame) cancelAnimationFrame(cardGlowFrame);
			clearCardSweep();
		};
	});

	$effect(() => {
		const step = currentStep;
		headingSettled = false;
		onPanelExpandedChange(step.panelExpanded);
		void tick().then(() => {
			refreshTargetRect();
			startCardSweep();
		});
	});

	function startTargetTracking(): void {
		const track = () => {
			refreshTargetRect();
			rafId = requestAnimationFrame(track);
		};

		track();
	}

	function refreshTargetRect(): void {
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;

		if (!currentStep.target || currentStep.placement === 'center') {
			targetRect = null;
			return;
		}

		const target = document.querySelector(currentStep.target);
		if (!(target instanceof HTMLElement) && !(target instanceof HTMLCanvasElement)) {
			targetRect = null;
			return;
		}

		const rect = target.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			targetRect = null;
			return;
		}

		const padding = currentStep.targetPadding ?? 8;
		const x = clamp(rect.left - padding, viewportMargin, viewportWidth - viewportMargin);
		const y = clamp(rect.top - padding, viewportMargin, viewportHeight - viewportMargin);
		const maxWidth = Math.max(0, viewportWidth - viewportMargin - x);
		const maxHeight = Math.max(0, viewportHeight - viewportMargin - y);

		targetRect = {
			x,
			y,
			width: Math.min(rect.width + padding * 2, maxWidth),
			height: Math.min(rect.height + padding * 2, maxHeight)
		};
	}

	function previousStep(): void {
		if (isFirstStep) return;
		prepareStepTransition();
		stepIndex -= 1;
	}

	function nextStep(): void {
		if (isLastStep) {
			onComplete();
			return;
		}

		prepareStepTransition();
		stepIndex += 1;
	}

	function skipTour(): void {
		onSkip();
	}

	function handleHeadingComplete(stepId: string, token: number): void {
		window.setTimeout(() => {
			if (currentStep.id !== stepId || headingRevealToken !== token) return;
			headingSettled = true;
		}, 70);
	}

	function handleCardPointerMove(event: PointerEvent): void {
		const card = event.currentTarget;
		if (!(card instanceof HTMLElement)) return;
		setCardGlowTargetFromClientPoint(card, event.clientX, event.clientY);
	}

	function handleCardPointerLeave(event: PointerEvent): void {
		const card = event.currentTarget;
		if (!(card instanceof HTMLElement) || card.classList.contains('sweep-active')) return;
		glowTarget = { ...glowTarget, edge: 0 };
		startCardGlowSmoothing(card);
	}

	function prepareStepTransition(): void {
		headingSettled = false;
		headingRevealToken += 1;
		clearCardSweep();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			skipTour();
			return;
		}

		if (event.key === 'ArrowRight') {
			event.preventDefault();
			nextStep();
			return;
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			previousStep();
		}
	}

	function rectToStyle(rect: Rect | null): string {
		if (!rect) return '';

		return `left: ${rect.x}px; top: ${rect.y}px; width: ${rect.width}px; height: ${rect.height}px;`;
	}

	function resolveCardPlacement(
		rect: Rect | null,
		width: number,
		height: number,
		preferred: WelcomeTourPlacement
	): CardPlacement {
		const usableCardWidth = effectiveCardWidth(width);

		if (!rect || preferred === 'center') {
			return {
				x: width / 2,
				y: height / 2,
				transform: 'translate(-50%, -50%)'
			};
		}

		const requestedSide = preferred === 'auto' ? chooseSide(rect, width, height) : preferred;
		const side = sideFits(requestedSide, rect, width, height)
			? requestedSide
			: chooseSide(rect, width, height);

		if (side === 'left') {
			return {
				x: Math.max(viewportMargin, rect.x - popoverGap),
				y: clamp(
					rect.y + rect.height / 2,
					viewportMargin + cardHeightEstimate / 2,
					height - viewportMargin - cardHeightEstimate / 2
				),
				transform: 'translate(-100%, -50%)'
			};
		}

		if (side === 'right') {
			return {
				x: Math.min(width - viewportMargin - usableCardWidth, rect.x + rect.width + popoverGap),
				y: clamp(
					rect.y + rect.height / 2,
					viewportMargin + cardHeightEstimate / 2,
					height - viewportMargin - cardHeightEstimate / 2
				),
				transform: 'translate(0, -50%)'
			};
		}

		if (side === 'top') {
			return {
				x: clamp(
					rect.x + rect.width / 2,
					viewportMargin + usableCardWidth / 2,
					width - viewportMargin - usableCardWidth / 2
				),
				y: Math.max(viewportMargin, rect.y - popoverGap),
				transform: 'translate(-50%, -100%)'
			};
		}

		return {
			x: clamp(
				rect.x + rect.width / 2,
				viewportMargin + usableCardWidth / 2,
				width - viewportMargin - usableCardWidth / 2
			),
			y: Math.max(
				viewportMargin,
				Math.min(height - viewportMargin - cardHeightEstimate, rect.y + rect.height + popoverGap)
			),
			transform: 'translate(-50%, 0)'
		};
	}

	function chooseSide(rect: Rect, width: number, height: number): WelcomeTourPlacement {
		const usableCardWidth = effectiveCardWidth(width);
		const leftSpace = rect.x;
		const rightSpace = width - (rect.x + rect.width);
		const bottomSpace = height - (rect.y + rect.height);
		const topSpace = rect.y;

		if (leftSpace >= usableCardWidth + popoverGap + viewportMargin) return 'left';
		if (rightSpace >= usableCardWidth + popoverGap + viewportMargin) return 'right';
		if (bottomSpace >= cardHeightEstimate + popoverGap + viewportMargin) return 'bottom';
		if (topSpace >= cardHeightEstimate + popoverGap + viewportMargin) return 'top';

		return bottomSpace >= topSpace ? 'bottom' : 'top';
	}

	function sideFits(
		side: WelcomeTourPlacement,
		rect: Rect,
		width: number,
		height: number
	): boolean {
		const usableCardWidth = effectiveCardWidth(width);

		if (side === 'left') return rect.x >= usableCardWidth + popoverGap + viewportMargin;
		if (side === 'right') {
			return width - (rect.x + rect.width) >= usableCardWidth + popoverGap + viewportMargin;
		}
		if (side === 'top') return rect.y >= cardHeightEstimate + popoverGap + viewportMargin;
		if (side === 'bottom') {
			return height - (rect.y + rect.height) >= cardHeightEstimate + popoverGap + viewportMargin;
		}

		return true;
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function effectiveCardWidth(currentViewportWidth: number): number {
		return Math.min(cardWidth, Math.max(0, currentViewportWidth - viewportMargin * 2));
	}

	function setCardGlowTargetFromClientPoint(
		card: HTMLElement,
		clientX: number,
		clientY: number
	): void {
		const rect = card.getBoundingClientRect();
		const target = getCardGlowTarget(
			clientX - rect.left,
			clientY - rect.top,
			rect.width,
			rect.height
		);
		glowTarget = target;
		startCardGlowSmoothing(card);
	}

	function getCardGlowTarget(
		x: number,
		y: number,
		width: number,
		height: number
	): { x: number; y: number; edge: number } {
		const distances = [
			{ side: 'left', value: x },
			{ side: 'right', value: width - x },
			{ side: 'top', value: y },
			{ side: 'bottom', value: height - y }
		] as const;
		const nearest = distances.reduce((best, next) => (next.value < best.value ? next : best));
		const edgeRange = Math.min(82, Math.max(42, Math.min(width, height) * 0.24));
		const edge = clamp((1 - nearest.value / edgeRange) * 100, 0, 100);
		const percentX = clamp((x / width) * 100, 0, 100);
		const percentY = clamp((y / height) * 100, 0, 100);

		if (nearest.side === 'left') return { x: 0, y: percentY, edge };
		if (nearest.side === 'right') return { x: 100, y: percentY, edge };
		if (nearest.side === 'top') return { x: percentX, y: 0, edge };
		return { x: percentX, y: 100, edge };
	}

	function startCardGlowSmoothing(card: HTMLElement): void {
		if (cardGlowFrame) return;
		const tick = () => {
			glowCurrent = {
				x: glowCurrent.x + (glowTarget.x - glowCurrent.x) * 0.16,
				y: glowCurrent.y + (glowTarget.y - glowCurrent.y) * 0.16,
				edge: glowCurrent.edge + (glowTarget.edge - glowCurrent.edge) * 0.18
			};
			setCardGlowVars(card, glowCurrent);

			if (
				Math.abs(glowCurrent.x - glowTarget.x) < 0.08 &&
				Math.abs(glowCurrent.y - glowTarget.y) < 0.08 &&
				Math.abs(glowCurrent.edge - glowTarget.edge) < 0.08
			) {
				glowCurrent = glowTarget;
				setCardGlowVars(card, glowCurrent);
				cardGlowFrame = 0;
				return;
			}

			cardGlowFrame = requestAnimationFrame(tick);
		};

		cardGlowFrame = requestAnimationFrame(tick);
	}

	function setCardGlowVars(
		card: HTMLElement,
		glow: {
			x: number;
			y: number;
			edge: number;
		}
	): void {
		card.style.setProperty('--edge-proximity', `${glow.edge.toFixed(3)}`);
		card.style.setProperty('--glow-x', `${glow.x.toFixed(3)}%`);
		card.style.setProperty('--glow-y', `${glow.y.toFixed(3)}%`);
	}

	function startCardSweep(): void {
		clearCardSweep();
		const card = tourCard;
		if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		sweepToken += 1;
		const token = sweepToken;
		let sweepEdge = 0;
		let sweepPoint = getPerimeterGlowPoint(0.08);

		card.classList.add('sweep-active');
		glowCurrent = { ...sweepPoint, edge: 0 };
		glowTarget = { ...sweepPoint, edge: 0 };
		setCardGlowVars(card, glowCurrent);

		animateCardValue({
			token,
			duration: 680,
			onUpdate: (value) => {
				sweepEdge = value;
				setCardGlowVars(card, { ...sweepPoint, edge: sweepEdge });
			}
		});
		animateCardValue({
			token,
			duration: 3200,
			ease: easeInOutCubic,
			onUpdate: (value) => {
				sweepPoint = getPerimeterGlowPoint(0.08 + value / 100);
				setCardGlowVars(card, { ...sweepPoint, edge: sweepEdge });
			}
		});
		animateCardValue({
			token,
			delay: 2550,
			duration: 1050,
			start: 100,
			end: 0,
			ease: easeOutCubic,
			onUpdate: (value) => {
				sweepEdge = value;
				setCardGlowVars(card, { ...sweepPoint, edge: sweepEdge });
			},
			onEnd: () => {
				if (token === sweepToken) card.classList.remove('sweep-active');
			}
		});
	}

	function clearCardSweep(): void {
		sweepToken += 1;
		if (sweepRafId) cancelAnimationFrame(sweepRafId);
		for (const timeout of sweepTimeouts) clearTimeout(timeout);
		sweepTimeouts = [];
		tourCard?.classList.remove('sweep-active');
	}

	function getPerimeterGlowPoint(progress: number): { x: number; y: number } {
		const wrapped = ((progress % 1) + 1) % 1;
		const sideProgress = (wrapped * 4) % 1;
		const side = Math.floor(wrapped * 4);

		if (side === 0) return { x: sideProgress * 100, y: 0 };
		if (side === 1) return { x: 100, y: sideProgress * 100 };
		if (side === 2) return { x: 100 - sideProgress * 100, y: 100 };
		return { x: 0, y: 100 - sideProgress * 100 };
	}

	function animateCardValue({
		token,
		start = 0,
		end = 100,
		duration = 1000,
		delay = 0,
		ease = easeOutCubic,
		onUpdate,
		onEnd
	}: {
		token: number;
		start?: number;
		end?: number;
		duration?: number;
		delay?: number;
		ease?: (value: number) => number;
		onUpdate: (value: number) => void;
		onEnd?: () => void;
	}): void {
		const timeout = setTimeout(() => {
			const startTime = performance.now();

			const tick = (time: number) => {
				if (token !== sweepToken) return;
				const progress = Math.min((time - startTime) / duration, 1);
				onUpdate(start + (end - start) * ease(progress));

				if (progress < 1) {
					sweepRafId = requestAnimationFrame(tick);
					return;
				}

				onEnd?.();
			};

			sweepRafId = requestAnimationFrame(tick);
		}, delay);

		sweepTimeouts.push(timeout);
	}

	function easeOutCubic(value: number): number {
		return 1 - Math.pow(1 - value, 3);
	}

	function easeInOutCubic(value: number): number {
		return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
	}
</script>

<div
	class="tour-overlay"
	class:has-spotlight={hasSpotlight}
	role="dialog"
	aria-modal="true"
	aria-labelledby="welcome-tour-title"
	aria-describedby="welcome-tour-body"
	tabindex="-1"
	bind:this={tourDialog}
	onkeydown={handleKeydown}
>
	{#if hasSpotlight}
		<div class="tour-spotlight" style={spotlightStyle} aria-hidden="true"></div>
	{:else}
		<div class="tour-scrim" aria-hidden="true"></div>
	{/if}

	<section
		class="tour-card"
		role="group"
		aria-label={`${currentStep.title} tour step`}
		style={cardStyle}
		data-tour-step={currentStep.id}
		bind:this={tourCard}
		onpointermove={handleCardPointerMove}
		onpointerleave={handleCardPointerLeave}
	>
		<span class="tour-edge-light" aria-hidden="true"></span>
		<div class="tour-card-inner">
			<div class="tour-topline">
				<span>{currentStep.kicker}</span>
				<small>{progressLabel}</small>
			</div>

			<div class="tour-copy">
				<h2
					id="welcome-tour-title"
					class:tour-welcome-title={currentStep.id === 'welcome'}
					aria-label={currentStep.title}
				>
					{#key currentStep.id}
						<TypedTourHeading
							text={currentStep.title}
							shineText={currentStep.id === 'welcome' ? 'Axial' : ''}
							onComplete={() => handleHeadingComplete(currentStep.id, headingRevealToken)}
						/>
					{/key}
				</h2>
				{#key currentStep.id}
					<p id="welcome-tour-body" class:visible={headingSettled}>{currentStep.body}</p>
				{/key}
			</div>

			<div class="tour-progress" aria-hidden="true">
				{#each WELCOME_TOUR_STEPS as step, index (step.id)}
					<span class:active={index <= stepIndex}></span>
				{/each}
			</div>

			<div class="tour-actions">
				<button type="button" class="tour-skip" onclick={skipTour}>
					<X size={14} strokeWidth={2.2} />
					<span>Skip</span>
				</button>

				<div>
					<button
						type="button"
						disabled={isFirstStep}
						onclick={previousStep}
						aria-label="Previous step"
					>
						<ArrowLeft size={15} strokeWidth={2.2} />
					</button>
					<button type="button" class="tour-next" onclick={nextStep}>
						{#if isLastStep}
							<Check size={15} strokeWidth={2.2} />
							<span>Finish</span>
						{:else}
							<span>Next</span>
							<ArrowRight size={15} strokeWidth={2.2} />
						{/if}
					</button>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.tour-overlay {
		position: absolute;
		inset: 0;
		z-index: 12;
		overflow: hidden;
		pointer-events: auto;
	}

	.tour-overlay:focus {
		outline: none;
	}

	.tour-scrim {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				circle at 50% 46%,
				color-mix(in oklab, var(--accent) 12%, transparent),
				transparent 38%
			),
			color-mix(in oklab, var(--field) 72%, #000 14%);
		backdrop-filter: blur(3px) saturate(0.92);
	}

	.tour-spotlight {
		position: absolute;
		border: 1px solid color-mix(in oklab, var(--accent) 66%, var(--text));
		border-radius: 1.05rem;
		box-shadow:
			0 0 0 9999px color-mix(in oklab, var(--field) 72%, #000 16%),
			0 0 0 1px color-mix(in oklab, #fff 18%, transparent),
			0 0 36px color-mix(in oklab, var(--accent) 34%, transparent);
		pointer-events: none;
		transition:
			left 280ms cubic-bezier(0.22, 1, 0.36, 1),
			top 280ms cubic-bezier(0.22, 1, 0.36, 1),
			width 280ms cubic-bezier(0.22, 1, 0.36, 1),
			height 280ms cubic-bezier(0.22, 1, 0.36, 1),
			border-radius 220ms ease;
	}

	.tour-card {
		--edge-proximity: 0;
		--glow-x: 50%;
		--glow-y: 0%;
		--edge-sensitivity: 34;
		--glow-padding: 0.24rem;

		position: absolute;
		left: var(--tour-card-x);
		top: var(--tour-card-y);
		display: grid;
		width: var(--tour-card-width);
		overflow: visible;
		border: 1px solid color-mix(in oklab, var(--accent) 38%, var(--text) 8%);
		border-radius: 1.55rem;
		background:
			linear-gradient(145deg, color-mix(in oklab, var(--accent) 12%, transparent), transparent 44%),
			color-mix(in oklab, var(--surface) 90%, transparent);
		color: var(--text);
		box-shadow:
			0 24px 72px color-mix(in oklab, #000 46%, transparent),
			inset 0 1px 0 color-mix(in oklab, #fff 13%, transparent);
		backdrop-filter: blur(22px) saturate(1.16);
		isolation: isolate;
		transform: var(--tour-card-transform);
		transition:
			left 280ms cubic-bezier(0.22, 1, 0.36, 1),
			top 280ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.tour-card > .tour-edge-light {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		content: '';
		pointer-events: none;
		transition: opacity 260ms ease-out;
	}

	.tour-card:not(:hover):not(.sweep-active) > .tour-edge-light {
		opacity: 0;
		transition: opacity 720ms ease-in-out;
	}

	.tour-card > .tour-edge-light {
		z-index: 1;
		inset: calc(var(--glow-padding) * -1);
		padding: var(--glow-padding);
		background: radial-gradient(
			circle at var(--glow-x) var(--glow-y),
			color-mix(in oklab, #fff 92%, var(--accent)) 0%,
			color-mix(in oklab, var(--accent) 72%, transparent) 18%,
			color-mix(in oklab, var(--accent) 30%, transparent) 30%,
			transparent 47%
		);
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
		mix-blend-mode: plus-lighter;
		opacity: calc(
			(var(--edge-proximity) - var(--edge-sensitivity)) / (100 - var(--edge-sensitivity))
		);
	}

	.tour-card-inner {
		position: relative;
		z-index: 2;
		display: grid;
		max-height: min(35rem, calc(100vh - 2.25rem));
		gap: 1.05rem;
		overflow: auto;
		padding: 1.32rem;
		border-radius: inherit;
	}

	.tour-topline,
	.tour-actions,
	.tour-actions div {
		display: flex;
		align-items: center;
	}

	.tour-topline {
		justify-content: space-between;
		gap: 0.8rem;
	}

	.tour-topline span,
	.tour-topline small {
		color: color-mix(in oklab, var(--accent) 72%, var(--text));
		font-size: 0.76rem;
		font-weight: 850;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	.tour-topline small {
		color: var(--muted);
		letter-spacing: 0;
	}

	.tour-copy {
		display: grid;
		gap: 0.64rem;
	}

	.tour-copy h2,
	.tour-copy p {
		margin: 0;
	}

	.tour-copy h2 {
		font-size: 3rem;
		font-weight: 760;
		line-height: 0.95;
		letter-spacing: 0;
	}

	.tour-copy h2.tour-welcome-title {
		font-size: 3.45rem;
	}

	.tour-copy p {
		color: color-mix(in oklab, var(--text) 78%, var(--muted));
		font-size: 1.08rem;
		font-weight: 600;
		line-height: 1.48;
		opacity: 0;
		transform: translateY(0.32rem);
		transition:
			opacity 320ms ease,
			transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.tour-copy p.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.tour-progress {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.22rem;
	}

	.tour-progress span {
		height: 0.31rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--text) 16%, transparent);
		transition: background 180ms ease;
	}

	.tour-progress span.active {
		background: color-mix(in oklab, var(--accent) 72%, var(--text));
		box-shadow: 0 0 14px color-mix(in oklab, var(--accent) 28%, transparent);
	}

	.tour-actions {
		justify-content: space-between;
		gap: 0.72rem;
	}

	.tour-actions div {
		gap: 0.34rem;
	}

	.tour-actions button {
		display: inline-flex;
		min-height: 2.12rem;
		align-items: center;
		justify-content: center;
		gap: 0.34rem;
		border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 52%, transparent);
		color: var(--text);
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 850;
		padding: 0 0.9rem;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.tour-actions button:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--accent) 48%, transparent);
		background: color-mix(in oklab, var(--accent) 16%, var(--surface));
	}

	.tour-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.tour-actions button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 58%, transparent);
		outline-offset: 2px;
	}

	.tour-actions .tour-skip {
		color: color-mix(in oklab, var(--text) 74%, var(--muted));
	}

	.tour-actions .tour-next {
		border-color: color-mix(in oklab, var(--accent) 46%, transparent);
		background: color-mix(in oklab, var(--accent) 24%, var(--surface));
		box-shadow: inset 0 1px 0 color-mix(in oklab, #fff 14%, transparent);
	}

	@media (max-width: 760px), (hover: none) and (pointer: coarse) {
		.tour-card {
			max-height: min(34rem, calc(100vh - 1rem));
			--glow-padding: 0.2rem;
			border-radius: 1.18rem;
		}

		.tour-card-inner {
			max-height: min(34rem, calc(100vh - 1rem));
			padding: 0.98rem;
			gap: 0.86rem;
		}

		.tour-copy h2 {
			font-size: 1.94rem;
		}

		.tour-copy h2.tour-welcome-title {
			font-size: 2.18rem;
		}

		.tour-copy p {
			font-size: 0.92rem;
			line-height: 1.43;
		}

		.tour-actions {
			align-items: stretch;
		}

		.tour-actions button {
			min-height: 2.18rem;
			padding-inline: 0.62rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tour-spotlight,
		.tour-card,
		.tour-card > .tour-edge-light,
		.tour-copy p,
		.tour-progress span,
		.tour-actions button {
			transition: none;
		}
	}
</style>
