cmake_minimum_required(VERSION 3.10)

project(stratusd)

set(CMAKE_CXX_STANDARD 20)

# libquiche - use pre-built static library
set(libquichepath "${CMAKE_CURRENT_SOURCE_DIR}/dist/libquiche.a")

add_library(libquiche STATIC IMPORTED GLOBAL)
set_target_properties(libquiche PROPERTIES
    IMPORTED_LOCATION "${libquichepath}"
)

target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/abseil-cpp+)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/boringssl+/include)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/quiche/common/platform/default/)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/protobuf+/src)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/+_repo_rules+com_google_googleurl)

# No ICU linking needed - pre-built libquiche.a links against system ICU at link time
