

const DEFAULT_VALUE = '...';
const LONGLAT_DECIMALS = 5;
const CHANCE_OF_RAIN_CUTOFF = 60;

const URL_CONFIG = 'http://watch.danericweiner.com';
const DARKSKY_HASH = '<darksky_api_key>';
const URL_LOGGING = 'http://watch.danericweiner.com/logging.cgi';

const WUNDERGROUND_API_KEY = 'WUNDERGROUND_API_KEY';
const DATA_ALTERNATE = 'DATA_ALTERNATE';
const WIND_ALTERNATE = 'WIND_ALTERNATE';
const SHOW_CITY = 'SHOW_CITY';
const INVERT =  'INVERT';
const UNITS_CELSIUS = 'UNITS_CELSIUS';

const KEY_TIDE = 'KEY_TIDE';
const KEY_WIND = 'KEY_WIND';
const KEY_SUNSET = 'KEY_SUNSET';
const KEY_TEMP = 'KEY_TEMP';
const KEY_FORECAST = 'KEY_FORECAST';
const KEY_LOCATION = 'KEY_LOCATION';
const KEY_INVERT = 'KEY_INVERT';

var wunderground_api_key;
var data_alternate;
var wind_alternate;
var show_city;
var invert;
var units_celsius;

var noaa_temp = DEFAULT_VALUE;   
var noaa_hi_temp = DEFAULT_VALUE;

// Listen for when the watchface is opened
Pebble.addEventListener('ready', 
  function(e) {
    sendSwitches();
    getLocation();
  }
);
        
// Listen for when an AppMessage is received
Pebble.addEventListener('appmessage',
  function(e) {    
    sendSwitches();
    getLocation();
    logging();
  }                     
);

Pebble.addEventListener('showConfiguration', function(e) {
    // Show config page
    wunderground_api_key = getFromStorage(WUNDERGROUND_API_KEY, '', false);
    data_alternate = getFromStorage(DATA_ALTERNATE, '', false);
    wind_alternate = getFromStorage(WIND_ALTERNATE, '', false);
    show_city = getFromStorage(SHOW_CITY, '', false);
    invert = getFromStorage(INVERT, '', false);
    units_celsius = getFromStorage(UNITS_CELSIUS, '', false);

    Pebble.openURL(URL_CONFIG + '?prior_data_alternate=' + data_alternate + '&prior_api_key=' + wunderground_api_key + '&prior_wind_alternate=' + wind_alternate + '&prior_show_city=' + show_city + '&prior_invert=' + invert + '&prior_units_celsius=' + units_celsius);
    });


Pebble.addEventListener('webviewclosed', function(e) {
    // Decode and parse config data as JSON
    var config_data = JSON.parse(decodeURIComponent(e.response));       
    window.localStorage.setItem(WUNDERGROUND_API_KEY, config_data.api_key);
    window.localStorage.setItem(DATA_ALTERNATE, config_data.data_alternate);
    window.localStorage.setItem(WIND_ALTERNATE, config_data.wind_alternate);
    window.localStorage.setItem(SHOW_CITY, config_data.show_city);
    window.localStorage.setItem(INVERT, config_data.invert);
    window.localStorage.setItem(UNITS_CELSIUS, config_data.units_celsius);

    clearFields();
    sendSwitches();
    getLocation();
  });

function clearFields(){
    var dictionary = {};
    dictionary[KEY_TIDE] = DEFAULT_VALUE + '/' + DEFAULT_VALUE + '  ' + DEFAULT_VALUE;
    dictionary[KEY_SUNSET] = DEFAULT_VALUE + "  " + DEFAULT_VALUE;
    dictionary[KEY_WIND] = DEFAULT_VALUE + ' ' + DEFAULT_VALUE;    
    dictionary[KEY_TEMP] = DEFAULT_VALUE + '/' + DEFAULT_VALUE;
    dictionary[KEY_FORECAST] = DEFAULT_VALUE;
    dictionary[KEY_LOCATION] = DEFAULT_VALUE + ", " + DEFAULT_VALUE;
    sendData(dictionary);
}

function logging() {
    var accountToken = Pebble.getAccountToken();
    var watchToken = Pebble.getWatchToken();
    var url = URL_LOGGING + '?' + encodeURIComponent(accountToken + ', ' + watchToken);
    
    var xhReq = new XMLHttpRequest();
    xhReq.onload = function() {};
    xhReq.open("GET", url);
    xhReq.send();
}

function sendSwitches()
{    
    invert = getFromStorage(INVERT, 'false', false);
    var dictionary = {};
    dictionary[KEY_INVERT] = invert;
    sendData(dictionary);
}

function getLocation()
{
    var options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 60000
          };
 
    // http://stackoverflow.com/questions/3397585/navigator-geolocation-getcurrentposition-sometimes-works-sometimes-doesnt
    // make a dummy call first since the second one usually works better
    navigator.geolocation.getCurrentPosition(function(){
        navigator.geolocation.getCurrentPosition(
                locationSuccess,
                locationError,
                options
        );
    },locationError,options);
}

function locationError(err)
{
    console.log('Error requesting location!');
}

function locationSuccess(pos){               
    wunderground_api_key = getFromStorage(WUNDERGROUND_API_KEY, 'na', false);
    data_alternate = getFromStorage(DATA_ALTERNATE, 'false', true);
    wind_alternate = getFromStorage(WIND_ALTERNATE, 'false', true);
    show_city = getFromStorage(SHOW_CITY, 'false', true);
    units_celsius = getFromStorage(UNITS_CELSIUS, 'false', true);

    if(!show_city){
        var dictionary = {};
        getLatLong(pos, dictionary);
        sendData(dictionary);    
    }

    callSunriseSunset(pos);

    if (data_alternate){        
        callWunderground(pos);
        if(wind_alternate){ callDarkSky(pos); }
    } else {  
        if(show_city){ callNOAAForCity(pos); }      
        callNOAAForForecast(pos);
        callNOAAForWeather(pos);
        callNOAAForTideStationId(pos);
    }
}

function getFromStorage(key, fallback, convertToBoolean){
    var result = fallback;
    if(window.localStorage.getItem(key)){
        result = window.localStorage.getItem(key);
    }
    if(convertToBoolean){
        result = (result === 'true');   // convert to boolean
    }

    return result;
}

function sendData(dictionary)
{   
    // Send to Pebble
    Pebble.sendAppMessage(dictionary,
       function(e) {
         console.log('Weather info sent to Pebble successfully!');
       },
       function(e) {
         console.log('Error sending weather info to Pebble!');
       }
     );    
}

function getLatLong(pos,dictionary) {
    
    var lat = DEFAULT_VALUE;
    var long = DEFAULT_VALUE;        
    
    try{
        lat = pos.coords.latitude.toFixed(LONGLAT_DECIMALS);
        long = pos.coords.longitude.toFixed(LONGLAT_DECIMALS);
    }
    catch(err){        
        lat = DEFAULT_VALUE;
        long = DEFAULT_VALUE;
    }
    
    dictionary[KEY_LOCATION] = lat + ", " + long;
}

function callSunriseSunset(pos)
{
    var url = 'https://api.sunrise-sunset.org/json?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude + '&date=today&formatted=0';               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        

        getSunriseSunsetAstronomy(json,dictionary);        
               
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getSunriseSunsetAstronomy(json,dictionary) {
   
    var sunrise = DEFAULT_VALUE;
    var sunset = DEFAULT_VALUE;
    
    try{  
        var sunset;
        var sunrise;

        if(json.results.sunset != null){
            sunset = new Date(json.results.sunset);
        }

        if(json.results.sunrise != null){
            sunrise = new Date(json.results.sunrise);
        }

        if ( sunset != null )
            sunset = toTwelveHour(sunset.getHours()) + ":" + makeTwoDigit(sunset.getMinutes());
        
        if ( sunrise != null )
            sunrise = toTwelveHour(sunrise.getHours()) + ":" + makeTwoDigit(sunrise.getMinutes());
    }
    catch(err){
        sunset = DEFAULT_VALUE;
        sunrise = DEFAULT_VALUE;
    }
    
    dictionary[KEY_SUNSET] = sunrise + "  " + sunset;
}

function callWunderground(pos)
{
    var url = 'http://api.wunderground.com/api/' + wunderground_api_key + '/geolookup/forecast/conditions/rawtide/tide/astronomy/q/' + pos.coords.latitude + ',' + pos.coords.longitude + '.json';               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        
        
        getWundergroundTemperature(json,dictionary);                
        getWundergroundTide(json,dictionary);
        
        if (!wind_alternate){
            getWundergroundWind(json,dictionary);
        } 
        
        if (show_city){
            getWundergroundCity(json,dictionary);
        }
        
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getWundergroundTemperature(json,dictionary) {
 
    var weather = DEFAULT_VALUE;
    var temp = DEFAULT_VALUE; 
    var hi_temp = DEFAULT_VALUE; 
    
    try{
        var current_hour = (new Date).getHours();
        var is_day_time = current_hour >= 6 && current_hour < 18;   // show the high during the day and low at night like noaa

        if (units_celsius){
            if ( json.current_observation.temp_c != null)
                temp = Math.round(json.current_observation.temp_c);
        } else {
            if ( json.current_observation.temp_f != null)
                temp = Math.round(json.current_observation.temp_f);        
        }        
                             
        if ( json.forecast.txt_forecast.forecastday[0].icon){                        
            weather = wundergroundWeatherString(json.forecast.txt_forecast.forecastday[0].icon);            
        }   

        if( is_day_time ){
	        if (units_celsius){
	            if ( json.forecast.simpleforecast.forecastday[0].high.celsius != null)
	                hi_temp = Math.round(json.forecast.simpleforecast.forecastday[0].high.celsius);
	        } else {
	            if ( json.forecast.simpleforecast.forecastday[0].high.fahrenheit != null)
	                hi_temp = Math.round(json.forecast.simpleforecast.forecastday[0].high.fahrenheit);        
	        }
        } else {
	        if (units_celsius){
	            if ( json.forecast.simpleforecast.forecastday[0].low.celsius != null)
	                hi_temp = Math.round(json.forecast.simpleforecast.forecastday[0].low.celsius);
	        } else {
	            if ( json.forecast.simpleforecast.forecastday[0].low.fahrenheit != null)
	                hi_temp = Math.round(json.forecast.simpleforecast.forecastday[0].low.fahrenheit);        
	        }
        }
              
    }
    catch(err){
        weather = DEFAULT_VALUE;
        temp = DEFAULT_VALUE;
        hi_temp = DEFAULT_VALUE;
    }
    
    dictionary[KEY_TEMP] = temp + '/' + hi_temp;
    dictionary[KEY_FORECAST] = weather;
}

function getWundergroundTide(json,dictionary) {

    var tide_height = DEFAULT_VALUE;
    var next_tide_height = DEFAULT_VALUE;
    var next_tide_time = DEFAULT_VALUE;
    
    try{
        if (json.rawtide.rawTideObs[0] != null)
            tide_height = Math.round(json.rawtide.rawTideObs[0].height);
        
        var tideSummary = json.tide.tideSummary;

        for (i = 0; i < tideSummary.length; i++)
        {        
            if (tideSummary[i].data.type.localeCompare('Low Tide') == 0
                    || tideSummary[i].data.type.localeCompare('High Tide') == 0)

            {
                next_tide_time = toTwelveHour(tideSummary[i].date.hour) + ":" + tideSummary[i].date.min;
                next_tide_height = Math.round(tideSummary[i].data.height.split(" ")[0]);
                break;
            }              
        }
    }
    catch(err){
        tide_height = DEFAULT_VALUE;
        next_tide_time = DEFAULT_VALUE;
        next_tide_height = DEFAULT_VALUE;
    }
    
    dictionary[KEY_TIDE] = tide_height + '/' + next_tide_height + '  ' + next_tide_time;
}

function getWundergroundWind(json,dictionary) {
    
    var wind_mph = DEFAULT_VALUE;
    var wind_dir = DEFAULT_VALUE;
    
    try{        
        if (json.current_observation.wind_mph != null)
            wind_mph = Math.round(json.current_observation.wind_mph);

        if (json.current_observation.wind_dir != null)
            wind_dir = json.current_observation.wind_dir.toLowerCase();
    }
    catch(err){        
        wind_mph = DEFAULT_VALUE;
        wind_dir = DEFAULT_VALUE;
    }
    
    dictionary[KEY_WIND] = wind_mph + ' ' + wind_dir;
}

function getWundergroundCity(json,dictionary) {
    
    var city = DEFAULT_VALUE;
    var state = DEFAULT_VALUE;
    
    try{
        if ( json.location.city != null)
            city = json.location.city.toLowerCase();                                                
        
        if ( json.location.state != null)
            state = json.location.state.toLowerCase();
    }
    catch(err){        
        city = DEFAULT_VALUE;
        state = DEFAULT_VALUE;
    }
    
    dictionary[KEY_LOCATION] = city + ", " + state;
}

function callDarkSky(pos)
{        
    // use my api key for now    
    var url = 'https://api.darksky.net/forecast/' + DARKSKY_HASH + '/' + pos.coords.latitude + ','+ pos.coords.longitude + '?exclude=minutely,hourly,daily,alerts,flags';         
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        
        
        getDarkSkyWind(json,dictionary); 
        
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();            
}

function getDarkSkyWind(json,dictionary) {
    
    var wind_mph = DEFAULT_VALUE;
    var wind_dir = DEFAULT_VALUE;
    
    try{       
        if (json.currently.windSpeed != null)
            wind_mph = Math.round(json.currently.windSpeed);

        if (json.currently.windBearing != null)            
            wind_dir = degToCompass(json.currently.windBearing).toLowerCase();
    }
    catch(err){        
        wind_mph = DEFAULT_VALUE;
        wind_dir = DEFAULT_VALUE;
    }
    
    dictionary[KEY_WIND] = wind_mph + ' ' + wind_dir;
}

function callNOAAForCity(pos)
{
    var url = 'https://api.weather.gov/points/' + pos.coords.latitude + ',' + pos.coords.longitude + '';               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        

        getNOAACity(json, dictionary);
                
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getNOAACity(json, dictionary) {

    var city = DEFAULT_VALUE;
    var state = DEFAULT_VALUE;
    
    try{
        if ( json.properties.relativeLocation.properties.city != null)
            city = json.properties.relativeLocation.properties.city.toLowerCase();                                                
        
        if ( json.properties.relativeLocation.properties.state != null)
            state = json.properties.relativeLocation.properties.state.toLowerCase();
    }
    catch(err){        
        city = DEFAULT_VALUE;
        state = DEFAULT_VALUE;
    }
    
    dictionary[KEY_LOCATION] = city + ", " + state;
}

function callNOAAForForecast(pos)
{
    var url = 'https://api.weather.gov/points/' + pos.coords.latitude + ',' + pos.coords.longitude + '/forecast';               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        
        
        getNOAAForecast(json,dictionary);                
               
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getNOAAForecast(json,dictionary) {

    var weather = DEFAULT_VALUE;

    try{                
        if ( json.properties.periods[0].icon){ 
            var iconString = json.properties.periods[0].icon;  
            var weatherAndPercentage = getFirstMatch(/\/([\w,]+)(?:\?|$)/, iconString);     // weather,percentage in between / and ? or end of line
            var weather = getFirstMatch(/(\w+)(?:,|$)/, weatherAndPercentage);              // weather before comma or end of line       
            var percentage = getFirstMatch(/,([0-9]+)/, weatherAndPercentage);              // percentage after comma 
            var questionMark = '';
            if (percentage != ""){
                percentage = parseFloat(percentage);
                if(showNOAAQuestionMark(weather) && percentage < CHANCE_OF_RAIN_CUTOFF){
                    questionMark = '?';
                }
            }

            weather = noaaWeatherString(weather) + questionMark;            
        }     

        if( json.properties.periods[0].temperature != null){
            if(units_celsius){
                noaa_hi_temp = Math.round(FtoC(json.properties.periods[0].temperature));    
            } else{
                noaa_hi_temp = Math.round(json.properties.periods[0].temperature);    
            }
        }       
    }
    catch(err){        
        weather = DEFAULT_VALUE;
        noaa_hi_temp = DEFAULT_VALUE;
    }
    
    dictionary[KEY_TEMP] = noaa_temp + '/' + noaa_hi_temp;
    dictionary[KEY_FORECAST] = weather;
}

function callNOAAForWeather(pos)
{
    var url = 'https://api.weather.gov/points/' + pos.coords.latitude + ',' + pos.coords.longitude + '/forecast/hourly';               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 
        var json = JSON.parse(this.responseText);        
        
        getNOAATemperature(json,dictionary);                
        getNOAAWind(json,dictionary);
               
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getNOAATemperature(json,dictionary) {
     
    try{
        if ( json.properties.periods[0].temperature != null){
            if(units_celsius){
                noaa_temp = Math.round(FtoC(json.properties.periods[0].temperature));    
            } else{
                noaa_temp = Math.round(json.properties.periods[0].temperature);    
            }
        }                      
    }
    catch(err){
        noaa_temp = DEFAULT_VALUE;
    }
    
    dictionary[KEY_TEMP] = noaa_temp + '/' + noaa_hi_temp;
}

function getNOAAWind(json,dictionary) {
    
    var wind_mph = DEFAULT_VALUE;
    var wind_dir = DEFAULT_VALUE;
    
    try{        
        if (json.properties.periods[0].windSpeed != null)
            wind_mph = Math.round(getFirstMatch(/^([0-9]+)/, json.properties.periods[0].windSpeed));    // number at beginning of line

        if (json.properties.periods[0].windDirection != null)
            wind_dir = formatNOAAWindString(json.properties.periods[0].windDirection);
    }
    catch(err){        
        wind_mph = DEFAULT_VALUE;
        wind_dir = DEFAULT_VALUE;
    }
    
    dictionary[KEY_WIND] = wind_mph + ' ' + wind_dir;
}

function callNOAAForTideStationId(pos)
{    
    var url = 'https://tidesandcurrents.noaa.gov/mdapi/latest/webapi/tidepredstations.json?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&radius=50';                   
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var stationId = "";
        
        try{            
            var json = JSON.parse(this.responseText);
        
            for(var i = 0; i < json.stationList.length; i++){
                if(json.stationList[i].stationType == 'R'){
                    stationId = json.stationList[i].stationId;
                    break;
                }
            }                                               
        }catch(err){
            // do nothing
        }                

        callNOAAForTide(stationId);        
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function callNOAAForTide(stationId)
{
    var dateString = getNOAADateString(); 
    
    var url = "https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=" + dateString + "&range=7&station=" + stationId + "&product=predictions&datum=mllw&units=english&time_zone=lst_ldt&application=web_services&format=json";               
    
    var xhReq = new XMLHttpRequest();
    
    xhReq.onload = function() {
        
        var dictionary = {}; 

        var json = null;
        try{
            json = JSON.parse(this.responseText);        
        } catch(err){
        }
                
        getNOAATide(json, dictionary);
                                
        // send populated data
        sendData(dictionary);
    };
    
    xhReq.open("GET", url);
    xhReq.send();               
}

function getNOAADateString(){
    var date = new Date();
    return makeTwoDigit(date.getMonth() + 1) + "/" + makeTwoDigit(date.getDate()) + "/" + date.getFullYear() + "%20" + makeTwoDigit(date.getHours()) + ":" + makeTwoDigit(date.getMinutes()) + "";        
}

function makeTwoDigit(datePart){
    return (datePart < 10 ? "0" : "") + datePart + "";
}

function getNOAATide(json, dictionary) {

	var tide_height = DEFAULT_VALUE;
	var next_tide_height = DEFAULT_VALUE;
	var next_tide_time = DEFAULT_VALUE;
	var station_name = DEFAULT_VALUE + ", " + DEFAULT_VALUE;
	
	try {
        var currentPrediction = parseFloat(json.predictions[0].v);
        var nextPrediction = parseFloat(json.predictions[1].v);
        var goingUp = currentPrediction < nextPrediction;
                
        var index;
        for (index = 1; index < json.predictions.length; index++) {
            var trail = parseFloat(json.predictions[index - 1].v);
            var trav = parseFloat(json.predictions[index].v);
            var goingUpNow = trail < trav;
            if (goingUpNow != goingUp) {
                break;
            }
        }        
        var next = json.predictions[index - 1];

        tide_height = Math.round(currentPrediction);
        next_tide_height = Math.round(parseFloat(next.v));
        next_tide_time = timeStringToTwelveHour(next.t.split(" ")[1]);
               
    } catch (err) {
        tide_height = DEFAULT_VALUE;
        next_tide_height = DEFAULT_VALUE;
        next_tide_time = DEFAULT_VALUE;
        station_name = DEFAULT_VALUE + ", " + DEFAULT_VALUE;
    }
    
    dictionary[KEY_TIDE] = tide_height + '/' + next_tide_height + '  ' + next_tide_time;
}

function timeStringToTwelveHour(timeString){    
    var hours = timeString.split(":")[0];
    var minutes = timeString.split(":")[1];    
    return toTwelveHour(hours) + ":" + minutes;
}

function toTwelveHour(hour){
    var result = (hour - 1) % 12 + 1;
    if (result == 0) result += 12;   // 12am is zero
    
    return result
}

function FtoC(temp){
    return (temp - 32.0) * 5.0 / 9.0;
}

function getFirstMatch(regex, string) {
    var result = '';
    try {        
        var match = regex.exec(string);
        if(match != null && match.length >= 2){
            result = match[1];        
        }
    } catch (err) {
    }

    return result;
}

function degToCompass(num) {
    var val = Math.floor((num / 22.5) + 0.5);
    var arr = ["North", "NNE", "NE", "ENE", "East", "ESE", "SE", "SSE", "South", "SSW", "SW", "WSW", "West", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
}

function formatNOAAWindString(wind_direction){
    var wind_lower = wind_direction.toLowerCase();
    switch(wind_lower){
        case 'n': return "north"; break;
        case 'e': return "east"; break;
        case 's': return "south"; break;
        case 'w': return "west"; break;
        default: return wind_lower;
    }
}

function wundergroundWeatherString(raw_weather){

    var result = DEFAULT_VALUE; 

    try{
        if (raw_weather != null){        
            raw_weather = raw_weather.toLowerCase();                       

            if(wunderground_array[raw_weather]) { 
                result = wunderground_array[raw_weather];
            }            
        }
    }
    catch(err){
        return result;
    }
    
    return result;
}

var wunderground_array = { 
	'chanceflurries': 'snow?',
	'chancerain': 'rain?',
	'chancesleet': 'sleet?',
	'chancesnow': 'snow?',
	'chancetstorms': 'storms?',
	'clear': 'clear',
	'cloudy': 'cloudy',
	'flurries': 'snow',
	'fog': 'fog',
	'hazy': 'hazy',
	'mostlycloudy': 'cloudy',
	'mostlysunny': 'clear',
	'partlycloudy': 'clear',
	'partlysunny': 'cloudy',
	'sleet': 'sleet',
	'rain': 'rain',
	'snow': 'snow',
	'sunny': 'clear',
	'tstorms': 'storms',
	'unknown': 'clear',
	'nt_chanceflurries': 'snow?',
	'nt_chancerain': 'rain?',
	'nt_chancesleet': 'sleet?',
	'nt_chancesnow': 'snow?',
	'nt_chancetstorms': 'storms?',
	'nt_clear': 'clear',
	'nt_cloudy': 'cloudy',
	'nt_flurries': 'snow',
	'nt_fog': 'fog',
	'nt_hazy': 'hazy',
	'nt_mostlycloudy': 'cloudy',
	'nt_mostlysunny': 'clear',
	'nt_partlycloudy': 'clear',
	'nt_partlysunny': 'cloudy',
	'nt_sleet': 'sleet',
	'nt_rain': 'rain',
	'nt_snow': 'snow',
	'nt_sunny': 'clear',
	'nt_tstorms': 'storms',
	'nt_unknown': 'clear'
};

function noaaWeatherString(raw_weather){

    var result = DEFAULT_VALUE; 

    try{
        if (raw_weather != null){        
            raw_weather = raw_weather.toLowerCase();                       

            if(noaa_array[raw_weather]) { 
                result = noaa_array[raw_weather];
            }            
        }
    }
    catch(err){
        return result;
    }
    
    return result;
}

var noaa_array = {
	"skc": "clear",
	"few": "clear",
	"sct": "clouds",
	"bkn": "cloudy",
	"ovc": "cloudy",
	"wind_skc": "clear",
	"wind_few": "clear",
	"wind_sct": "clouds",
	"wind_bkn": "cloudy",
	"wind_ovc": "cloudy",
	"snow": "snow",
	"rain_snow": "rain",
	"rain_sleet": "rain",
	"snow_sleet": "snow",
	"fzra": "rain",
	"rain_fzra": "rain",
	"snow_fzra": "snow",
	"sleet": "sleet",
	"rain": "rain",
	"rain_showers": "rain",
	"rain_showers_hi": "rain",
	"tsra": "storms",
	"tsra_sct": "storms",
	"tsra_hi": "storms",
	"tornado": "storms",
	"hurr_warn": "storms",
	"hurr_watch": "storms",
	"ts_warn": "storms",
	"ts_watch": "storms",
	"ts_hurr_warn": "storms",
	"dust": "dust",
	"smoke": "smoke",
	"haze": "haze",
	"hot": "hot",
	"cold": "cold",
	"blizzard": "storms",
	"fog": "fog"
};

function showNOAAQuestionMark(raw_weather){
    var result = false;
    
    try{
        if (raw_weather != null){        
            raw_weather = raw_weather.toLowerCase();                       

            return noaa_showquestion_array[raw_weather];          
        }
    }
    catch(err){
    }
    
    return result;
}

var noaa_showquestion_array = {
    "skc": false,
    "few": false,
    "sct": false,
    "bkn": false,
    "ovc": false,
    "wind_skc": false,
    "wind_few": false,
    "wind_sct": false,
    "wind_bkn": false,
    "wind_ovc": false,
    "snow": true,
    "rain_snow": true,
    "rain_sleet": true,
    "snow_sleet": true,
    "fzra": true,
    "rain_fzra": true,
    "snow_fzra": true,
    "sleet": true,
    "rain": true,
    "rain_showers": true,
    "rain_showers_hi": true,
    "tsra": true,
    "tsra_sct": true,
    "tsra_hi": true,
    "tornado": true,
    "hurr_warn": true,
    "hurr_watch": true,
    "ts_warn": true,
    "ts_watch": true,
    "ts_hurr_warn": true,
    "dust": false,
    "smoke": false,
    "haze": false,
    "hot": false,
    "cold": false,
    "blizzard": true,
    "fog": false
};