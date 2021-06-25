#include <pebble.h>

#define KEY_TIDE                0
#define KEY_WIND                1
#define KEY_SUNSET              2
#define KEY_TEMP                3
#define KEY_LOCATION            6
#define KEY_INVERT              8
#define KEY_SETTINGS            11
#define KEY_FORECAST            13

#define IMAGE_NUMBER            8
#define IMAGE_DELAY             50
#define IMAGE_LOOPS             10

#define APP_MESSAGE_IN_SIZE     1000
#define APP_MESSAGE_OUT_SIZE    1000

struct Config{
    bool invert_colors;
};
static struct Config settings;

static Window *s_main_window;
static TextLayer *s_time_layer;
static TextLayer *s_tide_layer;
static TextLayer *s_wind_layer;
static TextLayer *s_sunset_layer;
static TextLayer *s_temp_layer;
static TextLayer *s_day_layer;
static TextLayer *s_loc_layer;
static TextLayer *s_time_txt_layer;
static TextLayer *s_tide_txt_layer;
static TextLayer *s_wind_txt_layer;
static TextLayer *s_sunset_txt_layer;
static TextLayer *s_temp_txt_layer;
static TextLayer *s_day_txt_layer;
static TextLayer *s_loc_txt_layer;

static BitmapLayer *s_prop_layer;
static GBitmap *s_prop_bitmap[IMAGE_NUMBER];
static int image_to_display;

static bool invert_colors = false;
static GColor backcolormain;
static GColor backcolortext;
static GColor textcolortext;
static GColor backcolorbar;
static GColor textcolorbar;

int main(void);
static void deinit();
static void init();
static void main_window_unload(Window *);
static void main_window_load(Window *);
static void create_text_layers(Window *);
static void initialize_text_layers();
static void format_text(TextLayer *, char*, GTextAlignment, GColor, GColor);
static void tick_handler(struct tm *, TimeUnits);
static void update_time();
static void inbox_received_callback(DictionaryIterator *, void *);
static void inbox_dropped_callback(AppMessageResult, void *);
static void outbox_failed_callback(DictionaryIterator *, 
                                   AppMessageResult, void *); 
static void outbox_sent_callback(DictionaryIterator *, void *);
static void to_lower_case(char []);
static void strip_leading_day_zero(char [], char []);
static void format_all_text_layers();
static void add_all_text_layers(Window *);
static void create_bitmap(Window *);
static void set_bitmap_layer(int);
static void timer_handler(void *);
static void rotate_prop();
static void set_colors();
static void set_bitmap_colors();
static void set_colors();
static void do_invert_colors(bool);
static void restore_settings();

static void inbox_received_callback(DictionaryIterator *iterator, void *context)
{
        static char tide_buffer[32];
        static char wind_buffer[32];
        static char sunset_buffer[32];
        static char temp_buffer[32];
        static char forecast_buffer[32];
        static char loc_buffer[48];
        static char invert_buffer[6];

        Tuple *tide_tuple = dict_find(iterator, KEY_TIDE);
        Tuple *wind_tuple = dict_find(iterator, KEY_WIND);
        Tuple *sunset_tuple = dict_find(iterator, KEY_SUNSET);
        Tuple *temp_tuple = dict_find(iterator, KEY_TEMP);
        Tuple *forecast_tuple = dict_find(iterator, KEY_FORECAST);
        Tuple *loc_tuple = dict_find(iterator, KEY_LOCATION);
        Tuple *invert_tuple = dict_find(iterator, KEY_INVERT);
 
        if ( tide_tuple )
        {
                snprintf(tide_buffer, sizeof(tide_buffer), "%s", 
                        tide_tuple->value->cstring);
                text_layer_set_text(s_tide_layer, tide_buffer);
        }
        if ( wind_tuple )
        {
                snprintf(wind_buffer, sizeof(wind_buffer), "%s", 
                        wind_tuple->value->cstring);
                text_layer_set_text(s_wind_layer, wind_buffer);
        }
        if ( sunset_tuple )
        {
                snprintf(sunset_buffer, sizeof(sunset_buffer), "%s", 
                        sunset_tuple->value->cstring);
                text_layer_set_text(s_sunset_layer, sunset_buffer);
        }
        if ( temp_tuple )
        {
                snprintf(temp_buffer, sizeof(temp_buffer), "%s", 
                        temp_tuple->value->cstring);
                text_layer_set_text(s_temp_layer, temp_buffer);
        }
        if ( forecast_tuple )
        {
                snprintf(forecast_buffer, sizeof(forecast_buffer), "%s", 
                        forecast_tuple->value->cstring);
                text_layer_set_text(s_temp_txt_layer, forecast_buffer);
        }
        if ( loc_tuple )
        {
                snprintf(loc_buffer, sizeof(loc_buffer), "%s", 
                        loc_tuple->value->cstring);
                text_layer_set_text(s_loc_txt_layer, loc_buffer);
        }

        if ( invert_tuple )
        {
                snprintf(invert_buffer, sizeof(invert_buffer), "%s",
                        invert_tuple->value->cstring);
                do_invert_colors( strcmp(invert_buffer,"true") == 0 );
        }
}

static void do_invert_colors(bool invert){

        // get out if nothing to do
        if( (invert && invert_colors)
        || (!invert && !invert_colors))
            return;
    
        invert_colors = invert;
        settings.invert_colors = invert;
    
        persist_write_data(KEY_SETTINGS, &settings,sizeof(settings));
    
        set_colors();

        window_set_background_color(s_main_window, backcolormain);
        format_all_text_layers();

        set_bitmap_colors();
        set_bitmap_layer(image_to_display);
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) 
{
        APP_LOG(APP_LOG_LEVEL_ERROR, "Message dropped!");
}

static void outbox_failed_callback(DictionaryIterator *iterator, 
                                   AppMessageResult reason, void *context)
{
        APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed!");
}

static void outbox_sent_callback(DictionaryIterator *iterator, void *context)
{
        APP_LOG(APP_LOG_LEVEL_INFO, "Outbox send success!");
}
     
static void update_time() {
        // Get a tm structure
        time_t temp = time(NULL); 
        struct tm *tick_time = localtime(&temp);
        static char s_final[13];
        static char s_date_buffer[32];
        static char s_final_date[32];

        // Write the current hours and minutes into a buffer
        static char s_buffer[8];
        strftime(s_buffer, sizeof(s_buffer), clock_is_24h_style() ?
                                          "%H:%M" : "%I:%M", tick_time);

        // get date
        strftime(s_date_buffer, sizeof(s_date_buffer), 
                                          "%m/%d  %a", tick_time);

        // Trim leading 0
        s_final[0] = '\0';
        if ( !clock_is_24h_style() && s_buffer[0] == '0' ) 
                strcat(s_final, s_buffer + 1);
        else
                strcat(s_final, s_buffer);

        // Trim leading date 0
        strip_leading_day_zero(s_date_buffer, s_final_date);

        // Lowercase day value
        to_lower_case(s_final_date);

        // Display this time on the TextLayer
        text_layer_set_text(s_time_layer, s_final);

        // Display date on the date layer
        text_layer_set_text(s_day_layer, s_final_date);
}

static void strip_leading_day_zero(char datestr[], char result[])
{
        int i = 0;
        int j = 0;
       
        while (datestr[i] != '\0')
        {
                if (i == 0 && datestr[i] == '0')
                        i++;

                if (i > 0 && datestr[i - 1] == '/' && datestr[i] == '0' )
                        i++;

                result[j] = datestr[i];
                i++;
                j++;
        }

        result[j] = '\0';
}

static void to_lower_case(char str[])
{
        int i = 0;
        while ( str[i] )
        {
                if (str[i] >= 65 && str[i] <= 90 )
                        str[i] += 32;
                i++;
        }
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {

        // Get weather update every 30 minutes
        if(tick_time->tm_min % 30 == 0) {

                // clear the ui before getting weather; no stale data
                initialize_text_layers();
                update_time();

                // start the prop animation
                rotate_prop();

                // Begin dictionary
                DictionaryIterator *iter;
                app_message_outbox_begin(&iter);

                // Add a key-value pair
                dict_write_uint8(iter, 0, 0);

                // Send the message!
                app_message_outbox_send();
        }
        else {
                // just get the time; don't clear ui
                update_time();
        }
}

static void rotate_prop(){

        // Schedule a timer to advance the first frame
        app_timer_register(IMAGE_DELAY, timer_handler, NULL);
}

static void timer_handler(void *context) {

        if(image_to_display < IMAGE_NUMBER * IMAGE_LOOPS){ 
                image_to_display++;
                set_bitmap_layer(image_to_display);

                // set next timer delay
                app_timer_register(IMAGE_DELAY, timer_handler, NULL);
        } else {
                image_to_display = 0; 
                set_bitmap_layer(image_to_display);
        }
}

static void set_colors(){

        if( !invert_colors ){
                backcolormain = GColorBlack;
                backcolortext = GColorClear;
                textcolortext = GColorWhite;
                backcolorbar = GColorWhite;
                textcolorbar = GColorBlack;
        } else {
                backcolormain = GColorWhite;
                backcolortext = GColorClear;
                textcolortext = GColorBlack;
                backcolorbar = GColorBlack;
                textcolorbar = GColorWhite;
        }
}

static void format_text(TextLayer *s_text_layer, char* font,
                        GTextAlignment text_alignment, GColor backcolor, 
                        GColor textcolor)
{

        // Improve the layout to be more like a watchface
        text_layer_set_background_color(s_text_layer, backcolor);
        text_layer_set_text_color(s_text_layer, textcolor);
        text_layer_set_font(s_text_layer,
        fonts_get_system_font(font));
        text_layer_set_text_alignment(s_text_layer, text_alignment);

}

static void initialize_text_layers()
{
        text_layer_set_text(s_time_layer, "...");
        text_layer_set_text(s_tide_layer, ".../...  ...");
        text_layer_set_text(s_wind_layer, "... ...");
        text_layer_set_text(s_sunset_layer, "...  ...");
        text_layer_set_text(s_temp_layer, ".../...");
        text_layer_set_text(s_day_layer, ".../...  ..."); 
        
        text_layer_set_text(s_time_txt_layer, "now");
        text_layer_set_text(s_tide_txt_layer, "tide");
        text_layer_set_text(s_wind_txt_layer, "wind");
        text_layer_set_text(s_sunset_txt_layer, "sun");
        text_layer_set_text(s_temp_txt_layer, "...");
        text_layer_set_text(s_day_txt_layer, "day");

        text_layer_set_text(s_loc_layer, "");   // just background
        text_layer_set_text(s_loc_txt_layer, "..., ...");
}

static void create_text_layers(Window *window)
{
        // Get information about the Window
        Layer *window_layer = window_get_root_layer(window);
        GRect bounds = layer_get_bounds(window_layer);

        s_tide_layer = text_layer_create(GRect(0, -2, bounds.size.w, 25));
        s_sunset_layer = text_layer_create(GRect(0, 23, bounds.size.w, 25));
        s_wind_layer = text_layer_create(GRect(0, 48, bounds.size.w, 25));
        s_time_layer = text_layer_create(GRect(0, 73, bounds.size.w, 40));
        s_day_layer = text_layer_create(GRect(0, 103, bounds.size.w, 26));
        s_temp_layer = text_layer_create(GRect(0, 128, bounds.size.w, 26));
        
        s_tide_txt_layer = text_layer_create(GRect(0, -2, bounds.size.w, 25));
        s_sunset_txt_layer = text_layer_create(GRect(0, 23, bounds.size.w, 25));
        s_wind_txt_layer = text_layer_create(GRect(0, 48, bounds.size.w, 25));
        s_time_txt_layer = text_layer_create(GRect(0, 73, bounds.size.w, 40));
        s_day_txt_layer = text_layer_create(GRect(0, 103, bounds.size.w, 26));
        s_temp_txt_layer = text_layer_create(GRect(0, 128, bounds.size.w, 26));


        s_loc_layer = text_layer_create(GRect(0, 157, bounds.size.w, 15));
        s_loc_txt_layer = text_layer_create(GRect(0, 153, bounds.size.w, 15));
}

static void format_all_text_layers()
{

        // format text layers
        format_text(s_time_layer, FONT_KEY_GOTHIC_28_BOLD, GTextAlignmentRight,
                    backcolortext, textcolortext);
        format_text(s_tide_layer, FONT_KEY_GOTHIC_24_BOLD, GTextAlignmentRight,
                    backcolortext, textcolortext);
        format_text(s_wind_layer, FONT_KEY_GOTHIC_24_BOLD, GTextAlignmentRight,
                    backcolortext, textcolortext);
        format_text(s_sunset_layer,FONT_KEY_GOTHIC_24_BOLD,GTextAlignmentRight,
                    backcolortext, textcolortext);
        format_text(s_temp_layer, FONT_KEY_GOTHIC_24_BOLD, GTextAlignmentRight,
                    backcolortext, textcolortext);
        format_text(s_day_layer, FONT_KEY_GOTHIC_24_BOLD, GTextAlignmentRight,
                    backcolortext, textcolortext);


        // format text layers
        format_text(s_time_txt_layer, FONT_KEY_GOTHIC_28_BOLD, 
                    GTextAlignmentLeft, backcolortext, textcolortext);
        format_text(s_tide_txt_layer, FONT_KEY_GOTHIC_24_BOLD, 
                    GTextAlignmentLeft, backcolortext, textcolortext);
        format_text(s_wind_txt_layer, FONT_KEY_GOTHIC_24_BOLD, 
                    GTextAlignmentLeft, backcolortext, textcolortext);
        format_text(s_sunset_txt_layer,FONT_KEY_GOTHIC_24_BOLD,
                    GTextAlignmentLeft, backcolortext, textcolortext);
        format_text(s_temp_txt_layer, FONT_KEY_GOTHIC_24_BOLD,
                    GTextAlignmentLeft, backcolortext, textcolortext);
        format_text(s_day_txt_layer, FONT_KEY_GOTHIC_24_BOLD, 
                    GTextAlignmentLeft, backcolortext, textcolortext);
        

        format_text(s_loc_layer, FONT_KEY_GOTHIC_14, GTextAlignmentCenter,
                    backcolorbar, backcolorbar);
        format_text(s_loc_txt_layer, FONT_KEY_GOTHIC_14, GTextAlignmentCenter,
                    backcolortext, textcolorbar);

        layer_mark_dirty(text_layer_get_layer(s_time_layer));
        layer_mark_dirty(text_layer_get_layer(s_tide_layer));
        layer_mark_dirty(text_layer_get_layer(s_wind_layer));
        layer_mark_dirty(text_layer_get_layer(s_sunset_layer));
        layer_mark_dirty(text_layer_get_layer(s_temp_layer));
        layer_mark_dirty(text_layer_get_layer(s_day_layer));

        layer_mark_dirty(text_layer_get_layer(s_time_txt_layer));
        layer_mark_dirty(text_layer_get_layer(s_tide_txt_layer));
        layer_mark_dirty(text_layer_get_layer(s_wind_txt_layer));
        layer_mark_dirty(text_layer_get_layer(s_sunset_txt_layer));
        layer_mark_dirty(text_layer_get_layer(s_temp_txt_layer));
        layer_mark_dirty(text_layer_get_layer(s_day_txt_layer));

        layer_mark_dirty(text_layer_get_layer(s_loc_layer));
        layer_mark_dirty(text_layer_get_layer(s_loc_txt_layer));
}

static void add_all_text_layers(Window *window)
{
        // Get information about the Window
        Layer *window_layer = window_get_root_layer(window);

        // Add it as a child layer to the Window's root layer
        layer_add_child(window_layer, text_layer_get_layer(s_time_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_tide_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_wind_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_sunset_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_temp_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_day_layer));

        // Add it as a child layer to the Window's root layer
        layer_add_child(window_layer, text_layer_get_layer(s_time_txt_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_tide_txt_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_wind_txt_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_sunset_txt_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_temp_txt_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_day_txt_layer));

        layer_add_child(window_layer, text_layer_get_layer(s_loc_layer));
        layer_add_child(window_layer, text_layer_get_layer(s_loc_txt_layer));
}

static void create_bitmap(Window *window)
{
        // Get information about the Window
        Layer *window_layer = window_get_root_layer(window);
        GRect bounds = layer_get_bounds(window_layer);

        // Create GBitmap
        set_bitmap_colors();

        // Create BitmapLayer to display the GBitmap
        s_prop_layer = bitmap_layer_create(bounds);

        // Set the bitmap onto the layer add to the window
        set_bitmap_layer(0);
        bitmap_layer_set_compositing_mode(s_prop_layer,GCompOpSet);
        layer_add_child(window_layer, bitmap_layer_get_layer(s_prop_layer));

}

static void set_bitmap_colors(){

        GBitmap *s_prop_bitmap_temp[IMAGE_NUMBER];

       if ( !invert_colors ) {
                s_prop_bitmap_temp[0] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP000);
                s_prop_bitmap_temp[1] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP015);
                s_prop_bitmap_temp[2] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP030);
                s_prop_bitmap_temp[3] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP045);
                s_prop_bitmap_temp[4] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP060);
                s_prop_bitmap_temp[5] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP075);
                s_prop_bitmap_temp[6] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP090);
                s_prop_bitmap_temp[7] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP105);
       } else {
                s_prop_bitmap_temp[0] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP000_INVERT);
                s_prop_bitmap_temp[1] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP015_INVERT);
                s_prop_bitmap_temp[2] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP030_INVERT);
                s_prop_bitmap_temp[3] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP045_INVERT);
                s_prop_bitmap_temp[4] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP060_INVERT);
                s_prop_bitmap_temp[5] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP075_INVERT);
                s_prop_bitmap_temp[6] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP090_INVERT);
                s_prop_bitmap_temp[7] = gbitmap_create_with_resource(
                                            RESOURCE_ID_IMAGE_PROP105_INVERT);
        }

        for(int i = 0; i < IMAGE_NUMBER; i++){
                GBitmap *s_prop_bitmap_old = s_prop_bitmap[i];
                s_prop_bitmap[i] = s_prop_bitmap_temp[i];
                if ( s_prop_bitmap_old )
                    gbitmap_destroy(s_prop_bitmap_old);
        }
}

static void set_bitmap_layer(int i_image_number){
        
	  	i_image_number = i_image_number % IMAGE_NUMBER;
        bitmap_layer_set_bitmap(s_prop_layer, s_prop_bitmap[i_image_number]);

        layer_mark_dirty(bitmap_layer_get_layer(s_prop_layer));
}

static void restore_settings(){
    
        persist_read_data(KEY_SETTINGS, &settings, sizeof(settings));
        invert_colors = settings.invert_colors;
}

static void main_window_load(Window *window) {
    
        restore_settings();
    
        // initialize colors
        set_colors();

        // set background color
        window_set_background_color(window, backcolormain);

        // create text layers
        create_text_layers(window);
        initialize_text_layers();

        // format text layers
        format_all_text_layers();

        // add all text layers
        add_all_text_layers(window);

        // create the bitmap
        create_bitmap(window);

        // start the prop animation
        rotate_prop();
}

static void main_window_unload(Window *window) {
    
        // Destroy TextLayer
        text_layer_destroy(s_time_layer);
        text_layer_destroy(s_tide_layer);
        text_layer_destroy(s_wind_layer);
        text_layer_destroy(s_sunset_layer);
        text_layer_destroy(s_temp_layer);
        text_layer_destroy(s_day_layer);        
        
        text_layer_destroy(s_time_txt_layer);
        text_layer_destroy(s_tide_txt_layer);
        text_layer_destroy(s_wind_txt_layer);
        text_layer_destroy(s_sunset_txt_layer);
        text_layer_destroy(s_temp_txt_layer);
        text_layer_destroy(s_day_txt_layer);        

        text_layer_destroy(s_loc_layer);        
        text_layer_destroy(s_loc_txt_layer);        

        // Destroy GBitmap
        for(int i = 0; i < IMAGE_NUMBER; i++){
                gbitmap_destroy(s_prop_bitmap[i]);
        }
        bitmap_layer_destroy(s_prop_layer);
}


static void init() {
    
        // Create main Window element and assign to pointer
        s_main_window = window_create();

        // Set handlers to manage the elements inside the Window
        window_set_window_handlers(s_main_window, (WindowHandlers) {
        .load = main_window_load,
        .unload = main_window_unload
        });

        // Show the Window on the watch, with animated=true
        window_stack_push(s_main_window, true);

        // Make sure the time is displayed from the start
        update_time();

        // Register with TickTimerService
        tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);

        // Register callbacks
        app_message_register_inbox_received(inbox_received_callback);
        // Open AppMessage
        app_message_open((uint32_t)APP_MESSAGE_IN_SIZE, 
                         (uint32_t)APP_MESSAGE_OUT_SIZE);
        app_message_register_inbox_dropped(inbox_dropped_callback);
        app_message_register_outbox_failed(outbox_failed_callback);
        app_message_register_outbox_sent(outbox_sent_callback);
}

static void deinit() {
        // Destroy Window
        window_destroy(s_main_window);
}

int main(void) {
        init();
        app_event_loop();
        deinit();
}
