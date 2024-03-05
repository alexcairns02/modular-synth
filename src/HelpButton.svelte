<script>
    import { spring } from 'svelte/motion';

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
            size.set(30);
            module.toggleHelp();
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

    $: if (button) {
        button.style.width = `${$size}px`;
    }

    function setButton(node) {
        button = node;
        button.addEventListener('mousedown', buttonClick);
        button.addEventListener('touchstart', buttonClick);

        button.addEventListener('mouseup', buttonUnClick);
        button.addEventListener('touchend', buttonUnClick);

        window.addEventListener('mouseup', windowUnClick);
        window.addEventListener('touchend', buttonUnClick);

        button.addEventListener('mouseover', buttonHover);

        button.addEventListener('mouseout', buttonUnHover);
    }
</script>

<main>
    <!--source: -->
    <svg use:setButton xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 256 256" xml:space="preserve">

        <defs>
        </defs>
        <g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
            <path d="M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 43.17 21 c 0 -1.104 0.896 -2 2 -2 c 1.105 0 2 0.896 2 2 v 5.787 c 0 1.104 -0.895 2 -2 2 c -1.104 0 -2 -0.896 -2 -2 V 21 z M 51.639 71 H 45.17 c -1.104 0 -2 -0.896 -2 -2 V 42.064 h -4.809 c -1.104 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 h 6.809 c 1.105 0 2 0.896 2 2 V 67 h 4.469 c 1.104 0 2 0.896 2 2 S 52.743 71 51.639 71 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: #222222; fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
        </g>
    </svg>
</main>