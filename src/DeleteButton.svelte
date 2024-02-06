<script>
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import { destroyModule } from './utils';

    export let module;

    let size = spring(25, {
        stiffness: 0.3,
        damping: 0.5
    });

    let button;

    let clicking = false;

    const buttonClick = () => {
        size.set(35);
        clicking = true;
    };

    const buttonUnClick = () => {
        if (clicking) {
            destroyModule(module);
        }
    };

    const windowUnClick = () => {
        size.set(25);
        clicking = false;
    };

    const buttonHover = () => {
        if (!clicking) {
            size.set(30);
        }
    };

    const buttonUnHover = () => {
        if (!clicking) {
            size.set(25);
        }
    };

    onMount(() => {
        button.addEventListener('mousedown', buttonClick);
        button.addEventListener('touchstart', buttonClick);

        button.addEventListener('mouseup', buttonUnClick);
        button.addEventListener('touchend', buttonUnClick);

        window.addEventListener('mouseup', windowUnClick);
        window.addEventListener('touchend', buttonUnClick);

        button.addEventListener('mouseover', buttonHover);

        button.addEventListener('mouseout', buttonUnHover);

    });

    $: if (button) {
        button.style.width = `${$size}px`;
    }

    function setButton(node) {
        button = node;
    }
</script>

<main>
<svg use:setButton xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 256 256" xml:space="preserve">
    <defs>
    </defs>
    <g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
        <path d="M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 64.244 61.416 c 0.781 0.781 0.781 2.047 0 2.828 c -0.391 0.391 -0.902 0.586 -1.414 0.586 s -1.023 -0.195 -1.414 -0.586 L 45 47.828 L 28.583 64.244 c -0.39 0.391 -0.902 0.586 -1.414 0.586 s -1.024 -0.195 -1.414 -0.586 c -0.781 -0.781 -0.781 -2.047 0 -2.828 L 42.172 45 L 25.755 28.583 c -0.781 -0.781 -0.781 -2.047 0 -2.828 c 0.78 -0.781 2.048 -0.781 2.828 0 L 45 42.172 l 16.416 -16.416 c 0.781 -0.781 2.047 -0.781 2.828 0 c 0.781 0.781 0.781 2.047 0 2.828 L 47.828 45 L 64.244 61.416 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: #222222; fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
    </g>
</svg>
</main>

<style>
</style>