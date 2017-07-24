<template>
    <div id="app" class="container">
        <hr/>
        <button class="btn btn-primary" 
                @click="clickGetImagesInfo">
            Get Images Info From DB
        </button>
        <hr/>
        <my-table 
            :head_names="[ 'id', 'file_name' ]"
            :row_datas="images"
            @select_row="onSelectRow">
        </my-table>
        <hr/>
        <dcm-image-box ref="imgbox0"
            :dib_width="view_width"
            :dib_height="view_height"
            :dcm_image="dcm_image">
        </dcm-image-box>
    </div>
</template>

<script>
import MyTable from './components/my-table.vue';
import DcmImageBox from './components/dcm-image-Box.vue';
import DcmImageInfo from './classes/DcmImageInfo.js';

export default {
    name: 'app',
    components: { 
        'my-table': MyTable,
        'dcm-image-box': DcmImageBox
    },
    data () {
        return {
            images: [],
            view_width: 512,
            view_height: 512,
            dcm_image: null
        }
    }, 
    mounted() {
        // console.log(CuonUtils);
        // var xformMatrix = new Matrix4();
        // console.log(xformMatrix);
        // xformMatrix = null;
    },
    methods: {
        clickGetImagesInfo() {
            //this.message = this.message.split('').reverse().join('');
            window.axios({
                method: 'get',
                url: 'http://localhost:8080/image'
            }).then((response) => {
                //console.log(response);
                this.images = [];
                let i = 0;
                response.data.forEach((elmt) => {
                    elmt.index = i++;
                    elmt.selected = false;
                    Object.defineProperty(elmt, 'file_name', {
                        get: function() { 
                                return this.path.replace(/^.*[\\\/]/, ''); 
                        }
                    });
                    this.images.push(elmt);
                });
            });
        },
        onSelectRow(row) {
            //console.log(row);
            window.axios({
                method: 'get',
                url: 'http://localhost:8080/image/path/' + row.id
            }).then((response) => {
                this.dcm_image = null;
                this.dcm_image = new DcmImageInfo();
                this.dcm_image.setFromJson(response.data);
            })
        }
    }
}
</script>

<style>

</style>
