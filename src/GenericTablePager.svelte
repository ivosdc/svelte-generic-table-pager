<svelte:options tag={'table-pager'} accessors/>
<script>
    import {createEventDispatcher, onMount} from 'svelte';
    import {iconLeft, iconRight} from './SvgIcons'
    import SvelteGenericCrudTable from 'svelte-generic-crud-table/src/SvelteGenericCrudTable.svelte';

    let shadowed = false;
    const dispatch = createEventDispatcher();

    const pager_config_default = {
        name: 'table-paginator',
        lines: 1,
        steps: [0, 1, 2, 3, 4, 5, 10, 15, 20, 30],
        width: '500px'
    }

    export let pager_data = {};

    function getPagerData(data) {
        if (data.length > 0) {
            data = (typeof data === 'string') ? JSON.parse(data) : data;
            initPage();
        }
        return data;
    }

    $: pager_data = getPagerData(pager_data);

    export let pager_config = pager_config_default;

    function getPagerConfig(config) {
        let p_config = config === undefined ? pager_config_default : config;
        p_config = (typeof config === 'string') ? JSON.parse(config) : config;
        p_config.lines = p_config.lines === undefined ? p_config.steps[0] : p_config.lines;
        p_config.steps = setSteps();

        return p_config;
    }

    $: pager_config = getPagerConfig(pager_config);
    let setSteps = () => {
        let steps = (pager_config.steps !== undefined) ? pager_config.steps : pager_config_default.steps;
        if (pager_data.length > 0) {
            steps = steps.filter((a) => {
                return parseInt(a) < pager_data.length
            });
            steps.push(pager_data.length);
        }
        return steps;
    }

    function getSliderIndex(config) {
        let checkIndex = (config.steps !== undefined) ? config.steps.indexOf(config.lines) : 0;
        return checkIndex;
    }

    let sliderIndex = getSliderIndex(pager_config);

    let maxSteps = 1;
    let currentStep = 0;

    function getCurrentStep(config) {
        let conf = (config.steps !== undefined) ? config.steps[sliderIndex] : pager_config_default.steps[sliderIndex];
        sliderIndex = conf === undefined ? 1 : sliderIndex;
        return conf === undefined ? 1 : conf;
    }

    $: currentStep = getCurrentStep(pager_config);

    function getMaxSteps(config) {
        let checkMax = (config.steps !== undefined) ? (config.steps.length - 1) : (pager_config_default.steps.length - 1);

        return checkMax === 0 ? config.steps.length : checkMax;
    }

    $: maxSteps = getMaxSteps(pager_config);

    let currentPage = 1;

    let maxPages = 1;
    let max
    $: max = Math.ceil(pager_data.length / pager_config.lines);

    function getMaxPages(current_max) {
        let check_max = current_max > 0 ? current_max : 1;
        return check_max === Infinity ? 1 : check_max;
    }

    $: maxPages = getMaxPages(max);


    export let page_data;

    function getPageData(data) {
        pager_config.steps = setSteps();
        sliderIndex = sliderIndex > 1 ? sliderIndex-- : sliderIndex;
        return data === undefined ? [] : data;
    }

    $: page_data = getPageData(page_data);


    function initPage() {
        pager_config = (typeof pager_config === 'string') ? JSON.parse(pager_config) : pager_config;

        if (pager_config.lines === undefined) {
            pager_config.lines = 1;
        }
        page_data = pager_data.slice(pager_config.lines * (currentPage - 1), pager_config.lines * (currentPage));
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


    function handleLeft(event) {
        if (currentPage > 1) {
            getPreviousPage();
        }
    }

    function handleRight(event) {
        getNextPage();
    }

    function handlePagerConfig(event) {
        currentPage = 1;
        pager_config.steps = setSteps();
        pager_config.lines = pager_config.steps[sliderIndex];

        initPage();
    }

    function dispatcher(name, details, event) {
        dispatch(name, details);
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


    function handleCreate(event) {
        const details = {};
        dispatcher('create', details, event);
    }

    function handleDelete(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('delete', details, event);
    }

    function handleUpdate(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('update', details, event);
    }

    function handleDetail(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('details', details, event);
    }

    function handleSort(event) {
        const column = event.detail.column;
        const details = {
            column: column
        };
        dispatcher('sort', details, event);
    }

    export let table_config = {};


</script>

<div class="pager"
      style="width:{(pager_config.width !== undefined) ? pager_config.width : pager_config_default.width}">
    <span id="left" class="options left {(currentPage > 1) ? 'active' : 'inactive'}" style="float:left"
          on:click={(e) => handleLeft(e)} title="Left" tabindex="0">
        {#if (currentPage > 1)}
            {@html iconLeft}
        {:else}
            o
        {/if}
    </span>
    <span id="right"
          class="options right {(pager_data.length > (currentPage * pager_config.lines)) ? 'active' : 'inactive'}"
          style="float:left"
          on:click={(e) => handleRight(e)} title="Right" tabindex="0">
        {@html iconRight}
    </span>
    <span class="range" style="float:left">
        <input id="slider" type=range bind:value={sliderIndex} min=1 max={maxSteps} steps={maxSteps}
               on:input={handlePagerConfig}>
        <span class="number-rows"> {currentStep} rows</span>
    </span>
    <span class="info" style="clear:both">
        lines: <span class="number-lines">{firstLineOfPage()}-{lastLineOfPage()} ({pager_data.length})</span>
         -
        pages: <span class="number-pages">{currentPage}/{maxPages}</span>
    </span>
</div>
{#if typeof page_data !== 'string'}
    <SvelteGenericCrudTable on:delete={handleDelete}
                            on:update={handleUpdate}
                            on:create={handleCreate}
                            on:details={handleDetail}
                            on:sort={handleSort}
                            shadowed={false}
                            table_config={table_config}
                            bind:table_data={page_data}/>
{/if}
<style>

    .range {
        background: #fff;
        height: 1.3em;
        border-radius: 5rem;
        box-shadow: 1px 1px 1px rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 0.3em;
        outline: none;
        border: none;
        text-align: left;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
    }

    .number-rows {
        padding-left: 0.4em;
        padding-top: 0.1em;
    }

    .pager {
        text-align: center;
        min-width: 400px;
        max-width: 100%;
        margin-left: 1em;
        height: 1.8em;
    }

    .number-pages {
        font-size: 110%;
        font-weight: 200;
    }

    .number-lines {
        padding-top: 0.3em;
        font-size: 110%;
        font-weight: 200;
    }

    .info {
        position: relative;
        top: -0.2em;
        text-align: left;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
        padding-left: 2em;
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
        top: -0.1em;
        width: 16px;
        height: 16px;
        padding: 0.2em;
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
        width: 80%;
        height: 9px;
        background: #bdbdbd;
        border-radius: 3rem;

        transition: all 0.5s;
        cursor: pointer;
    }

    input[type="range"]:hover::-moz-range-track {
        background: #ff6e40;
    }


</style>
