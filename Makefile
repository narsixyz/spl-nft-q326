.PHONY: all test spl nft spl-init spl-metadata spl-mint spl-transfer nft-image nft-metadata nft-mint nft-update

all: test

test: spl nft

spl: spl-init wait spl-metadata spl-mint spl-transfer

nft: nft-image nft-metadata nft-mint nft-update

spl-init:
	npm run spl:init

wait:
	sleep 5

spl-metadata:
	npm run spl:metadata

spl-mint:
	npm run spl:mint

spl-transfer:
	npm run spl:transfer

nft-image:
	npm run nft:image

nft-metadata:
	npm run nft:metadata

nft-mint:
	npm run nft:mint

nft-update:
	npm run nft:update
