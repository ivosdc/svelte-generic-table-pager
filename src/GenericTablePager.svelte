<svelte:options tag={'table-pager'}/>
<script>
    import {afterUpdate, createEventDispatcher, onDestroy, onMount} from 'svelte';
    import {GenericTablePagerService} from "./GenericTablePagerService";
    import {iconLeft, iconRight} from './SvgIcons'

    /* istanbul ignore next line */
    let shadowed = document.querySelector('table-pager') !== null ? true : false;

    const dispatch = createEventDispatcher();

    const pager_config_default = {
        name: 'table-paginator',
        lines: 10,
        steps: [1, 2, 5, 10, 20, 50],
        width: '500px'
    }

    /* istanbul ignore next line */
    export let pager_data = {};
    /* istanbul ignore next line */
    $: pager_data = (typeof pager_data === 'string') ? JSON.parse(pager_data) : pager_data;

    /* istanbul ignore next line */
    export let pager_config = pager_config_default;
    /* istanbul ignore next line */
    $: pager_config = (typeof pager_config === 'string') ? JSON.parse(pager_config) : pager_config;
    let setSteps = () => {
        console.log(pager_data.length)
        let steps = (pager_config.steps !== undefined) ? pager_config.steps : pager_config_default.steps;
        steps = steps.filter((a) => {
            return a < pager_data.length
        });
        steps.push(pager_data.length);
        return steps;
    }
    pager_config.steps = setSteps();
    let setLinesBySteps = () => {
        let current = (pager_config.lines !== undefined) ? pager_config.lines : pager_config_default.lines;
        let current_set = 1;
        if (pager_config.steps !== undefined) {
            pager_config.steps.forEach((step) => {
                if (step <= current && step >= current_set) {
                    current_set = step;
                }
            })
        }

        return current_set;
    }
    $: pager_config.lines = setLinesBySteps();

    let sliderIndex = 0;
    let maxSteps = 1;
    let currentStep = 0;
    $: currentStep = (pager_config.steps !== undefined) ? pager_config.steps[sliderIndex] : pager_config_default.steps[sliderIndex];
    $: maxSteps = (pager_config.steps !== undefined) ? (pager_config.steps.length - 1) : (pager_config_default.steps.length - 1);

    let pagerService = new GenericTablePagerService();

    let currentPage = 0;

    let maxPages = 0;
    $: maxPages = Math.ceil(pager_data.length / pager_config.lines);




    let page_data = [];

    // workaround for webcomponent behaviour
    if (!shadowed) {
        onMount(initFirstPage);
    } else {
        afterUpdate(initFirstPage);
    }

    let initpage = 0;

    function initFirstPage() {
        if (shadowed) {
            if (initpage < 3) { // ToDo : WTF
                let elem = document.querySelector('table-pager').shadowRoot.getElementById('right');
                elem.click();
                initpage++;
                sliderIndex = (pager_config.steps !== undefined) ? pager_config.steps.indexOf(pager_config.lines) : 0;
            }
        } else {
            getNextPage()
            const details = {
                page: currentPage,
                pages: maxPages,
                body: page_data
            }
            dispatcher('newpage', details);
            sliderIndex = (pager_config.steps !== undefined) ? pager_config.steps.indexOf(pager_config.lines) : 0;
        }
    }


    function getNextPage() {
        if (currentPage < maxPages) {
            page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1));
            currentPage++;
        }
    }


    function getPreviousPage() {
        if (currentPage > 1) {
            page_data = pager_data.slice((pager_config.lines * currentPage) - pager_config.lines * 2,
                    (pager_config.lines * (currentPage + 1)) - pager_config.lines * 2);
            currentPage--;
        }
    }

    function getFirstPage() {
        page_data = pager_data.slice(0, pager_config.lines);
    }

    function handleLeft(event) {
        if (currentPage > 1) {
            getPreviousPage();
            const details = {
                page: currentPage,
                pages: maxPages,
                body: page_data
            }
            dispatcher('newpage', details, event);
        }
    }

    function handleRight(event) {
        getNextPage();
        const details = {
            page: currentPage,
            pages: maxPages,
            body: page_data
        }
        dispatcher('newpage', details, event);
    }

    function handlePagerConfig(event) {
        pager_config.lines = pager_config.steps[sliderIndex];
        pager_config.steps = setSteps();
        getFirstPage();
        const details = {
            page: currentPage,
            pages: maxPages,
            body: page_data
        }
        dispatcher('newpage', details, event);
    }

    function dispatcher(name, details, event) {
        /* istanbul ignore next */
        if (shadowed) {
            event.target.dispatchEvent(
                    new CustomEvent(name, {
                        composed: true,
                        detail: details
                    }))
        } else {
            dispatch(name, details);
        }
    }

    let firstLineOfPage = 0;
    $: firstLineOfPage = () => {
        return (pager_config.lines * (currentPage - 1)) + 1;
    }


    let lastLineOfPage = 0;
    $: lastLineOfPage = () => {
        const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
        return (last > pager_data.length) ? pager_data.length : last;
    }

</script>

<main class="pager"
      style="width:{(pager_config.width !== undefined) ? pager_config.width : pager_config_default.width}">
    <span id="left" class="options left {(currentPage > 1) ? 'active' : 'inactive'}" style="float:left"
          on:click={(e) => handleLeft(e)} title="Left" tabindex="0">
        {@html iconLeft}
    </span>
    <span id="right"
          class="options right {(pager_data.length > (currentPage * pager_config.lines)) ? 'active' : 'inactive'}"
          style="float:left"
          on:click={(e) => handleRight(e)} title="Right" tabindex="0">
        {@html iconRight}
    </span>
    <span class="info range" style="float:left">
        <input id="slider" type=range bind:value={sliderIndex} min=0 max={maxSteps} steps={maxSteps}
               on:input={handlePagerConfig}>
        <span class="number-rows"> {currentStep} rows</span>
    </span>
    <span class="info" style="float:right">
        lines: <span class="number-lines">{pager_data.length} / {firstLineOfPage()}-{lastLineOfPage()}</span>
        /
        page: <span class="number">{currentPage}/{maxPages}</span>
    </span>

</main>

<style>
    .range {
        background: #fff;
        height: 1.3em;
        border-radius: 5rem;
        box-shadow: 1px 1px 1px rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 0.25em;
        outline: none;
        border: none;
    }

    .number-rows {
        position: relative;
        top: -0.3em;
        padding-left: 0.4em;
    }

    input[type="range"] {
        -webkit-appearance: none;
        width: 100px;
        background: transparent;
    }

    input[type="range"]:focus {
        outline: none;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 1em;
        width: 1em;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -0.25em;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;

    }

    input[type="range"]::-webkit-slider-runnable-track {
        width: 60%;
        height: 9px;
        background: #dddddd;
        border-radius: 3rem;

        transition: all 0.5s;
        cursor: pointer;
    }

    input[type="range"]:hover::-webkit-slider-runnable-track {
        background: #ff6e40;
    }

    input[type="range"]::-ms-track {
        width: 60%;
        cursor: pointer;
        height: 9px;

        transition: all 0.5s;
        /* Hides the slider so custom styles can be added */
        background: transparent;
        border-color: transparent;
        color: transparent;
    }

    input[type="range"]::-ms-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -5px;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;
    }

    input[type="range"]::-ms-fill-lower {
        background: #bdbdbd;
        border-radius: 3rem;
    }

    input[type="range"]:focus::-ms-fill-lower {
        background: #ff6e40;
    }

    input[type="range"]::-ms-fill-upper {
        background: #bdbdbd;
        border-radius: 3rem;
    }

    input[type="range"]:focus::-ms-fill-upper {
        background: #ff6e40;
    }

    input[type="range"]::-moz-range-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -5px;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;
    }

    input[type="range"]::-moz-range-track {
        width: 60%;
        height: 9px;
        background: #bdbdbd;
        border-radius: 3rem;

        transition: all 0.5s;
        cursor: pointer;
    }

    input[type="range"]:hover::-moz-range-track {
        background: #ff6e40;
    }


    .pager {
        text-align: center;
        min-width: 220px;
        max-width: 100%;
        margin-left: 1em;
        height: 1em;
    }


    .number {
        font-size: 0.65em;
    }

    .number-lines {
        font-size: 0.6em;
    }

    .info {
        position: relative;
        top: 0.3em;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
        width: 200px;
    }

    .inactive {
        visibility: hidden;
    }

    .active {
        visibility: visible;
    }

    .active:hover {
        color: limegreen;
        opacity: 80%;
    }

    .options {
        position: relative;
        top: 0;
        width: 16px;
        height: 16px;
        padding: 0.2em 0.4em;
        cursor: pointer;
        opacity: 60%;
        color: #999999;
    }

    .options:hover {
        opacity: 100%;
    }

    .options:focus {
        border: none;
        outline: none;
        opacity: 100%;
    }

</style>
