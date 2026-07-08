-- Minimal baseline config for the agent-dev container.
-- Extend this with your own plugins (e.g. lazy.nvim) as needed.

vim.g.mapleader = " "

local opt = vim.opt
opt.number = true
opt.relativenumber = true
opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.smartindent = true
opt.termguicolors = true
opt.mouse = "a"
opt.clipboard = "unnamedplus"
opt.ignorecase = true
opt.smartcase = true
opt.splitright = true
opt.splitbelow = true
opt.updatetime = 300

-- Quick sanity keymaps
vim.keymap.set("n", "<leader>w", ":w<CR>", { desc = "Save file" })
vim.keymap.set("n", "<leader>q", ":q<CR>", { desc = "Quit" })
vim.keymap.set("n", "<C-h>", "<C-w>h")
vim.keymap.set("n", "<C-l>", "<C-w>l")
vim.keymap.set("n", "<C-j>", "<C-w>j")
vim.keymap.set("n", "<C-k>", "<C-w>k")

-- Bootstrap lazy.nvim if you want to add plugins later:
-- local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
-- if not vim.loop.fs_stat(lazypath) then
--   vim.fn.system({ "git", "clone", "--filter=blob:none",
--     "https://github.com/folke/lazy.nvim.git", lazypath })
-- end
-- vim.opt.rtp:prepend(lazypath)
-- require("lazy").setup("plugins")
