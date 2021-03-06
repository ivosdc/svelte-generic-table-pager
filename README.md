# svelte-generic-table-pager

A svelte paginator using svelte-generic-crud-table.

- Svelte-component: `import GenericTablePager from 'svelte-generic-table-pager'`

[See REPL on svelte.dev:](https://svelte.dev/repl/b81c81da687c432fa407bb6bbd1a1713?version=3.38.2 "Example")

## Install

```
npm install svelte-generic-table-pager
```

# Usage
Use the svelte-generic-table-pager in your component to show, edit, update and delete it's content *paginated*.
Just include the table as seen in the example below.

## column settings
All fields are optional.

Settings regarding a column behaviour can be specified in the table_config.
Only wanted keys of your source array have to be mapped by columns_settings *name*. All other attributes are optional.
```js
    const table_config = {
        name: 'Awesome',
        options: ['CREATE', 'EDIT', 'DELETE', 'DETAILS'],
        columns_setting: [
            {name: 'id', show: false, edit: true, width: '0px'},
            {name: 'job', show: true, edit: true, width: '150px', description: 'The job'},
            {name: 'name', show: true, edit: true, width: '150px', tooltip: true},
            {name: 'private', show: true, edit: false, width: '200px', description: 'your things', tooltip: true},
            {name: 'html', show: true, edit: true, width: '500px', type: 'html', description: 'You can use HTML', tooltip: true}
        ],
        details_text: 'detail'   // replace the standard icon with an text-link
    }
```
- <b>*name*</b>: the key from your data-array. This is used as column name.
- *show*: true/false; Should this column displayed? (optional, default: false)
- *edit*: true/false; Set this field editable or not. (optional, default: false)
- *width*: px/em; set the field width.  (optional, default: 100px)
- *description*: A tooltip for the columns name. E.g. to see the full name or other description.  (optional, default: unset)
- *tooltip*: true/false; When the text does not fit into the field you can show the full text as tooltip.  (optional, default: false)
- *type*: There are two types:  (optional, default: text)
    - *text*: Default.
    - *html*: The value/text will be interpreted as HTML.

[See REPL on svelte.dev:](https://svelte.dev/repl/b81c81da687c432fa407bb6bbd1a1713?version=3.38.2 "Example")

###  Svelte-Component:
```html
<script>
    import GenericTablePager from 'svelte-generic-table-pager/src/GenericTablePager.svelte'

    function handleDelete(event) {
        const id = event.detail.id; // position in myObjectArray
        const body = event.detail.body; // object to delete
        console.log(JSON.stringify(event.detail.body));
        myObjectArray.slice(id,1);
    }

    function handleUpdate(event) {
        const id = event.detail.id; // position in table
        const body = event.detail.body;
        console.log(JSON.stringify(body));
        myObjectArray[id] = body;
    }

    function handleCreate(event) {
        console.log(JSON.stringify(event.detail)); // empty object is passed by now
        myObjectArray.push({id: -1, name:'new Element', sthg:'2345', why:'1234'})
        const copy = myObjectArray;
        myObjectArray = [];
        myObjectArray = copy;
    }

    function handleDetails(event) {
        const id = event.detail.id; // position in table
        const body = event.detail.body;
        console.log(JSON.stringify(body));
    }


    function handleSort(e) {
        console.log(e);
    }

    let myObjectArray = [
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_12", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_13", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_14", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_15", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_16", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_17", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_18", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_19", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_12345", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 2, name: "A_NAME_2", sthg: "A_STHG_2", why: "I can"}
    ];


</script>

<main>
    <GenericTablePager on:delete={handleDelete}
                       on:update={handleUpdate}
                       on:create={handleCreate}
                       on:details={handleDetails}
                       on:sort={handleSort}
                       table_config={{
                           name: 'Awesome:',
                           options: ['CREATE', 'EDIT', 'DELETE', 'DETAILS'],
                           columns_setting: [
                               {name: 'id', show: false, edit: true, size: '200px'},
                               {name: 'name', show: true, edit: true, size: '200px'},
                               {name: 'why', show: true, edit: true, size: '200px'},
                               {name: 'sthg', show: true, edit: false, size: '200px'}
                           ],
                       details_text: 'detail'   // replace the standard icon with an text-link
                       }}
                       pager_data={myObjectArray}
                       pager_config={{
                                    name: 'crud-table-pager',
                                    lines: 5,
                                    steps: [1, 2, 5, 10, 20, 50],
                                    width: '600px'
                                    }}/></GenericTablePager>
</main>
```
