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
        width: '250px'
    }

    /* istanbul ignore next line */
    export let pager_data = {};
    /* istanbul ignore next line */
    $: pager_data = (typeof pager_data === 'string') ? JSON.parse(pager_data) : pager_data;

    /* istanbul ignore next line */
    export let pager_config = pager_config_default;
    /* istanbul ignore next line */
    $: pager_config = (typeof pager_config === 'string') ? JSON.parse(pager_config) : pager_config;

    let pagerService = new GenericTablePagerService();

    let currentPage;
    $: currentPage = 0;

    let maxLines = pager_data.length;
    $: maxLines = pager_data.length;

    let maxPages = 0;
    $: maxPages = Math.ceil(maxLines / pager_config.lines);


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
            }
        } else {
            getNextPage()
            const details = {
                page: currentPage,
                pages: maxPages,
                body: page_data
            }
            dispatcher('newpage', details);
        }

        if (maxLines <= pager_config.lines + 1) {
            if (shadowed) {
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.remove('active');
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.add('inactive');
            } else {
                document.getElementById('right').classList.remove('active');
                document.getElementById('right').classList.add('inactive');
            }
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

<main class="pager" style="width:{(pager_config.width !== undefined) ? pager_config.width : pager_config_default.width}">
    <span id="left" class="options left {(currentPage > 1) ? 'active' : 'inactive'}" style="float:left"
          on:click={(e) => handleLeft(e)} title="Left" tabindex="0">
        {@html iconLeft}
    </span>
    <span id="right" class="options right {(maxLines > (currentPage * pager_config.lines)) ? 'active' : 'inactive'}" style="float:left"
          on:click={(e) => handleRight(e)} title="Right" tabindex="0">
        {@html iconRight}
    </span>
    <span class="info">
        lines: <span class="number-lines">{maxLines} / {firstLineOfPage()}-{lastLineOfPage()}</span>
        /
        page: <span class="number">{currentPage}/{maxPages}</span>
    </span>

</main>

<style>

    .pager {
        text-align: center;
        min-width: 220px;
        max-width: 100%;
    }


    .number {
        font-size: 0.65em;
    }

    .number-lines {
        font-size: 0.6em;
    }

    .info {
        position: relative;
        top: 0.25em;
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
        top: 0.25em;
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
